import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { TokenService } from '../src/auth/token.service.js';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-that-is-long-enough-for-hs256';

// In-memory repository with the admin-management methods (D114).
function harness(accounts) {
  const audits = [];
  const otps = [];
  const sent = [];
  const refreshTokens = [];
  const deletedAvatars = [];
  const repo = {
    findAccountById: async (id) => accounts.find((account) => account.id === id) || null,
    findByEmail: async (email) => accounts.find((account) => account.email === email) || null,
    listAccounts: async () => ({ items: accounts, total: accounts.length }),
    countActiveAdmins: async () => accounts.filter((account) => account.role === 'ADMIN' && account.status === 'ACTIVE').length,
    createAccount: async (account) => account,
    saveAccount: async (account) => account,
    saveAudit: async (audit) => { audits.push({ id: crypto.randomUUID(), createdAt: new Date(), ...audit }); },
    updateAccountAndAudit: async (account, audit) => {
      refreshTokens.filter((token) => token.accountId === account.id).forEach((token) => { token.revokedAt = new Date(); });
      audits.push({ id: crypto.randomUUID(), createdAt: new Date(), ...audit });
    },
    countActiveSessions: async (accountId) => new Set(refreshTokens.filter((token) => token.accountId === accountId && !token.revokedAt).map((token) => token.familyId)).size,
    listAudits: async (targetAccountId) => audits.filter((audit) => audit.targetAccountId === targetAccountId).reverse().map((audit) => ({ ...audit, actorEmail: accounts.find((account) => account.id === audit.actorId)?.email || null, actorDisplayName: null })),
    updateLastLogin: async (id, at) => { Object.assign(accounts.find((account) => account.id === id), { lastLoginAt: at }); },
    accountStats: async () => ({ total: accounts.length, byStatus: { ACTIVE: accounts.length }, byRole: {}, activeLast7Days: 1, stalePending: 0, newPerDay: [{ day: '2026-10-19', count: 2 }] }),
    saveRefreshToken: async (token) => { refreshTokens.push({ ...token }); },
    countRecentOtps: async () => 0,
    findLatestOtp: async () => null,
    invalidateOtps: async () => {},
    saveOtp: async (otp) => { otps.push(otp); },
  };
  const avatarStorage = { delete: async (asset) => { deletedAvatars.push(asset); } };
  const service = new AuthService(repo, new PasswordService(), new TokenService(), { sendOtp: async (email, code, purpose) => { sent.push({ email, purpose }); } }, new AuthorizationService(), avatarStorage);
  return { service, controller: new AuthController(service), token: (account) => service.tokenService.createAccessToken(account), audits, otps, sent, refreshTokens, deletedAvatars };
}
function account(role, overrides = {}) {
  return { id: crypto.randomUUID(), email: `${role.toLowerCase()}-${crypto.randomUUID()}@example.com`, role, status: 'ACTIVE', createdAt: new Date(), sessionVersion: 0, passwordHash: new PasswordService().hash('correct horse battery staple'), ...overrides };
}

test('locking an account needs a reason, which is stored, audited and shown at sign-in', async () => {
  const admin = account('ADMIN');
  const student = account('STUDENT');
  const h = harness([admin, student]);
  await assert.rejects(() => h.service.adminUpdate(h.token(admin), student.id, { status: 'SUSPENDED' }), { code: 29 });
  const updated = await h.service.adminUpdate(h.token(admin), student.id, { status: 'SUSPENDED', reason: 'Shared answers during a mock test' });
  assert.equal(updated.account.status, 'SUSPENDED');
  assert.equal(updated.account.statusReason, 'Shared answers during a mock test');
  assert.equal(h.audits.at(-1).reason, 'Shared answers during a mock test');
  // The person sees the reason when signing in.
  await assert.rejects(
    () => h.service.login({ email: student.email, password: 'correct horse battery staple' }),
    (error) => error.code === 22 && error.reason === 'Shared answers during a mock test',
  );
  await assert.rejects(
    () => h.controller.login({ email: student.email, password: 'correct horse battery staple' }, { setHeader() {} }),
    (error) => error.getStatus() === 403 && error.getResponse().data.reason === 'Shared answers during a mock test',
  );
  // Unlocking clears the reason; a role change alone needs none.
  const unlocked = await h.service.adminUpdate(h.token(admin), student.id, { status: 'ACTIVE' });
  assert.equal(unlocked.account.statusReason, null);
  const promoted = await h.service.adminUpdate(h.token(admin), student.id, { role: 'CONTENT_MANAGER' });
  assert.equal(promoted.account.role, 'CONTENT_MANAGER');
  assert.equal(promoted.account.statusReason, null);
});

test('the admin account page carries live sessions and the audit trail; sign-ins are recorded', async () => {
  const admin = account('ADMIN');
  const student = account('STUDENT', { displayName: 'Minh Anh' });
  const h = harness([admin, student]);
  assert.equal(student.lastLoginAt, undefined);
  const session = await h.service.login({ email: student.email, password: 'correct horse battery staple' });
  assert.ok(student.lastLoginAt instanceof Date);
  assert.equal(session.account.displayName, 'Minh Anh');
  await h.service.adminUpdate(h.token(admin), student.id, { status: 'DISABLED', reason: 'Requested by the learner' });
  const page = await h.service.adminGet(h.token(admin), student.id);
  assert.equal(page.account.displayName, 'Minh Anh');
  assert.equal(page.account.lastLoginAt, student.lastLoginAt.toISOString());
  assert.equal(page.account.statusReason, 'Requested by the learner');
  // The lock revoked the session the login created.
  assert.equal(page.activeSessions, 0);
  assert.deepEqual(page.audits.map((audit) => [audit.action, audit.actor, audit.reason, audit.nextStatus]), [['STATUS_UPDATED', admin.email, 'Requested by the learner', 'DISABLED']]);
});

test('one-off admin actions: sign out everywhere, send a reset email, remove the avatar, reset the name', async () => {
  const admin = account('ADMIN');
  const student = account('STUDENT', { displayName: 'Rude Name', avatarUrl: 'https://ik.test/a.webp', avatarStorage: 'imagekit', avatarStorageId: 'file-1' });
  const h = harness([admin, student]);
  await h.service.login({ email: student.email, password: 'correct horse battery staple' });
  const token = h.token(admin);

  const revoked = await h.service.adminAction(token, student.id, { action: 'REVOKE_SESSIONS', reason: 'Lost phone' });
  assert.equal(revoked.changed, true);
  assert.equal(student.sessionVersion, 1);
  assert.equal(h.refreshTokens.every((row) => row.revokedAt), true);

  const reset = await h.service.adminAction(token, student.id, { action: 'SEND_PASSWORD_RESET' });
  assert.equal(reset.changed, true);
  assert.deepEqual(h.sent, [{ email: student.email, purpose: 'RESET_PASSWORD' }]);

  const noAvatar = await h.service.adminAction(token, student.id, { action: 'REMOVE_AVATAR', reason: 'Not a photo of a person' });
  assert.equal(noAvatar.account.avatarUrl, null);
  assert.deepEqual(h.deletedAvatars, [{ storage: 'imagekit', storageId: 'file-1' }]);
  assert.equal((await h.service.adminAction(token, student.id, { action: 'REMOVE_AVATAR' })).changed, false);

  const renamed = await h.service.adminAction(token, student.id, { action: 'RESET_DISPLAY_NAME', reason: 'Offensive' });
  assert.equal(renamed.account.displayName, null);
  assert.equal((await h.service.adminAction(token, student.id, { action: 'RESET_DISPLAY_NAME' })).changed, false);

  assert.deepEqual(h.audits.map((audit) => [audit.action, audit.reason]), [
    ['SESSIONS_REVOKED', 'Lost phone'],
    ['PASSWORD_RESET_SENT', null],
    ['AVATAR_REMOVED', 'Not a photo of a person'],
    ['DISPLAY_NAME_RESET', 'Offensive'],
  ]);

  // A reset email needs an ACTIVE account; non-admins are refused; bad actions are 400.
  student.status = 'PENDING_VERIFICATION';
  await assert.rejects(() => h.service.adminAction(token, student.id, { action: 'SEND_PASSWORD_RESET' }), { code: 25 });
  await assert.rejects(() => h.service.adminAction(h.token(student), admin.id, { action: 'REVOKE_SESSIONS' }), { code: 26 });
  await assert.rejects(() => h.controller.adminAction(student.id, { action: 'DELETE_EVERYTHING' }, token), (error) => error.getStatus() === 400 && error.getResponse().code === 30);
});

test('account statistics are admin-only and pass the repository numbers through', async () => {
  const admin = account('ADMIN');
  const student = account('STUDENT');
  const h = harness([admin, student]);
  const stats = await h.service.adminStats(h.token(admin));
  assert.deepEqual([stats.total, stats.activeLast7Days, stats.days, stats.newPerDay], [2, 1, 30, [{ day: '2026-10-19', count: 2 }]]);
  await assert.rejects(() => h.service.adminStats(h.token(student)), { code: 26 });
  await assert.rejects(() => h.controller.adminStats(undefined), (error) => error.getStatus() === 401);
});

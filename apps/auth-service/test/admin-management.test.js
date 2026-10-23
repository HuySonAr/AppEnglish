import test from 'node:test';
import assert from 'node:assert/strict';
import { lastWeeks, startOfDay } from '../src/auth/admin-notices.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { TokenService } from '../src/auth/token.service.js';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-that-is-long-enough-for-hs256';

function harness(accounts) {
  const audits = [];
  const noticeReads = [];
  const otps = [];
  const sent = [];
  const codes = [];
  const refreshTokens = [];
  const deletedAvatars = [];
  const repo = {
    findAccountById: async (id) => accounts.find((account) => account.id === id) || null,
    findByEmail: async (email) => accounts.find((account) => account.email === email) || null,
    listAccounts: async () => ({ items: accounts, total: accounts.length }),
    countActiveAdmins: async () => accounts.filter((account) => account.role === 'ADMIN' && account.status === 'ACTIVE').length,
    createAccount: async (account) => {
      if (!account.id) Object.assign(account, { id: crypto.randomUUID(), createdAt: new Date(), sessionVersion: 0 });
      if (!accounts.includes(account)) accounts.push(account);
      return account;
    },
    saveAccount: async (account) => account,
    saveAudit: async (audit) => { audits.push({ id: crypto.randomUUID(), createdAt: new Date(), ...audit }); },
    updateAccountAndAudit: async (account, audit) => {
      refreshTokens.filter((token) => token.accountId === account.id).forEach((token) => { token.revokedAt = new Date(); });
      audits.push({ id: crypto.randomUUID(), createdAt: new Date(), ...audit });
    },
    countActiveSessions: async (accountId) => new Set(refreshTokens.filter((token) => token.accountId === accountId && !token.revokedAt).map((token) => token.familyId)).size,
    listAudits: async (targetAccountId) => audits.filter((audit) => audit.targetAccountId === targetAccountId).reverse().map((audit) => ({ ...audit, actorEmail: accounts.find((account) => account.id === audit.actorId)?.email || null, actorDisplayName: null })),
    updateLastLogin: async (id, at) => { Object.assign(accounts.find((account) => account.id === id), { lastLoginAt: at }); },
    countStudentsCreatedBetween: async (from, to) => accounts.filter((account) => account.role === 'STUDENT' && account.createdAt >= from && account.createdAt < to).length,
    readNoticeKeys: async (accountId, keys) => new Set(noticeReads.filter((row) => row.accountId === accountId && keys.includes(row.key)).map((row) => row.key)),
    markNoticesRead: async (accountId, keys) => { for (const key of keys) if (!noticeReads.some((row) => row.accountId === accountId && row.key === key)) noticeReads.push({ accountId, key }); },
    accountStats: async () => ({ total: accounts.length, byStatus: { ACTIVE: accounts.length }, byRole: {}, activeLast7Days: 1, stalePending: 0, newPerDay: [{ day: '2026-10-19', count: 2 }] }),
    saveRefreshToken: async (token) => { refreshTokens.push({ ...token }); },
    countRecentOtps: async () => 0,
    findLatestOtp: async () => null,
    invalidateOtps: async () => {},
    saveOtp: async (otp) => { otps.push({ id: crypto.randomUUID(), ...otp }); },
    findLatestOtpChallenge: async (accountId, purpose) => [...otps].reverse().find((otp) => otp.accountId === accountId && otp.purpose === purpose) || null,
    updateOtp: async (id, changes) => { Object.assign(otps.find((otp) => otp.id === id), changes); },
    revokeAccountSessions: async () => {},
  };
  const avatarStorage = { delete: async (asset) => { deletedAvatars.push(asset); } };
  const service = new AuthService(repo, new PasswordService(), new TokenService(), { sendOtp: async (email, code, purpose, context) => { sent.push({ email, purpose, ...(context && Object.keys(context).length ? { context } : {}) }); codes.push(code); } }, new AuthorizationService(), avatarStorage);
  return { service, controller: new AuthController(service), token: (account) => service.tokenService.createAccessToken(account), audits, otps, sent, codes, refreshTokens, deletedAvatars };
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
  await assert.rejects(
    () => h.service.login({ email: student.email, password: 'correct horse battery staple' }),
    (error) => error.code === 22 && error.reason === 'Shared answers during a mock test',
  );
  await assert.rejects(
    () => h.controller.login({ email: student.email, password: 'correct horse battery staple' }, { setHeader() {} }),
    (error) => error.getStatus() === 403 && error.getResponse().data.reason === 'Shared answers during a mock test',
  );
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

test('an admin invites an account; the person accepts with the emailed code and a password', async () => {
  const admin = account('ADMIN');
  const someone = account('STUDENT');
  const h = harness([admin, someone]);
  const token = h.token(admin);

  await assert.rejects(() => h.service.adminInvite(h.token(someone), { email: 'x@example.com', displayName: '', role: 'STUDENT' }), { code: 26 });
  const invited = await h.service.adminInvite(token, { email: 'new.manager@example.com', displayName: 'Mai', role: 'CONTENT_MANAGER' });
  assert.equal(invited.expiresInHours, 72);
  assert.equal(invited.account.status, 'PENDING_VERIFICATION');
  assert.equal(invited.account.role, 'CONTENT_MANAGER');
  assert.equal(invited.account.displayName, 'Mai');
  assert.ok(invited.account.invitedAt);
  assert.deepEqual(h.sent, [{ email: 'new.manager@example.com', purpose: 'INVITE', context: { role: 'CONTENT_MANAGER', displayName: 'Mai', expiresInHours: 72 } }]);
  assert.ok(h.otps[0].expiresAt.getTime() - Date.now() > 71 * 3600000);
  assert.deepEqual(h.audits.map((audit) => audit.action), ['ACCOUNT_INVITED']);
  await assert.rejects(() => h.service.adminInvite(token, { email: 'new.manager@example.com', displayName: '', role: 'STUDENT' }), { code: 19 });

  const stored = h.audits[0] && (await h.service.accountRepository.findByEmail('new.manager@example.com'));
  await assert.rejects(() => h.service.login({ email: stored.email, password: 'anything at all' }), { code: 10 });
  await assert.rejects(() => h.service.acceptInvite({ email: stored.email, otp: '000000', password: 'chosen by the person' }), (error) => error.code === 15 || error.code === 16);
  h.otps.forEach((otp) => { otp.resendAfter = new Date(0); });
  const resent = await h.service.adminAction(token, stored.id, { action: 'RESEND_INVITE' });
  assert.equal(resent.expiresInHours, 72);
  assert.equal(h.sent.length, 2);
  const session = await h.service.acceptInvite({ email: stored.email, otp: h.codes.at(-1), password: 'chosen by the person' });
  assert.equal(session.account.status, 'ACTIVE');
  assert.equal(session.account.role, 'CONTENT_MANAGER');
  assert.ok(session.setCookies.length);
  assert.ok(stored.emailVerifiedAt);
  assert.equal((await h.service.login({ email: stored.email, password: 'chosen by the person' })).account.id, stored.id);
  assert.equal((await h.service.acceptInvite({ email: stored.email, otp: '123456', password: 'another password' })).data.nextAction, 'LOGIN');
  await assert.rejects(() => h.service.acceptInvite({ email: 'nobody@example.com', otp: '123456', password: 'another password' }), { code: 15 });
  await assert.rejects(() => h.service.acceptInvite({ email: admin.email, otp: '123456', password: 'another password' }), { code: 15 });
  assert.deepEqual(h.audits.map((audit) => audit.action), ['ACCOUNT_INVITED', 'INVITE_RESENT', 'INVITE_ACCEPTED']);
  await assert.rejects(() => h.service.adminAction(token, stored.id, { action: 'RESEND_INVITE' }), { code: 25 });
});

test('a self-registered pending account can get a new code or be activated with a reason; invited ones cannot', async () => {
  const admin = account('ADMIN');
  const pending = account('STUDENT', { status: 'PENDING_VERIFICATION' });
  const invited = account('STUDENT', { status: 'PENDING_VERIFICATION', invitedAt: new Date() });
  const active = account('STUDENT');
  const h = harness([admin, pending, invited, active]);
  const token = h.token(admin);

  const code = await h.service.adminAction(token, pending.id, { action: 'RESEND_VERIFICATION' });
  assert.equal(code.expiresInSeconds, 300);
  assert.deepEqual(h.sent, [{ email: pending.email, purpose: 'VERIFY_EMAIL' }]);
  await assert.rejects(() => h.service.adminAction(token, invited.id, { action: 'RESEND_VERIFICATION' }), { code: 25 });
  await assert.rejects(() => h.service.adminAction(token, active.id, { action: 'RESEND_VERIFICATION' }), { code: 25 });
  await assert.rejects(() => h.service.adminAction(token, pending.id, { action: 'RESEND_INVITE' }), { code: 25 });

  await assert.rejects(() => h.service.adminAction(token, pending.id, { action: 'ACTIVATE' }), { code: 29 });
  await assert.rejects(() => h.service.adminAction(token, invited.id, { action: 'ACTIVATE', reason: 'x' }), { code: 25 });
  await assert.rejects(() => h.service.adminAction(token, active.id, { action: 'ACTIVATE', reason: 'x' }), { code: 25 });
  const activated = await h.service.adminAction(token, pending.id, { action: 'ACTIVATE', reason: 'Code never arrived; identity checked by phone' });
  assert.equal(activated.account.status, 'ACTIVE');
  assert.equal(pending.emailVerifiedAt, undefined);
  assert.equal((await h.service.login({ email: pending.email, password: 'correct horse battery staple' })).account.status, 'ACTIVE');
  assert.deepEqual(h.audits.map((audit) => [audit.action, audit.previousStatus, audit.nextStatus, audit.reason]), [
    ['VERIFICATION_RESENT', 'PENDING_VERIFICATION', 'PENDING_VERIFICATION', null],
    ['ACCOUNT_ACTIVATED', 'PENDING_VERIFICATION', 'ACTIVE', 'Code never arrived; identity checked by phone'],
  ]);

  const reset = await h.service.adminAction(token, active.id, { action: 'RESET_PLACEMENT', reason: 'Asked to retake' });
  assert.equal(reset.changed, true);
  await assert.rejects(() => h.service.adminAction(token, admin.id, { action: 'RESET_PLACEMENT' }), { code: 26 });
  assert.deepEqual(h.audits.at(-1).action, 'PLACEMENT_RESET');
});

test('an admin is told how many learners joined last week, Monday to Sunday in Vietnam time (D164)', async () => {
  const weeks = lastWeeks(new Date());
  const inWeek = (week, hours) => new Date(startOfDay(week).getTime() + hours * 3600000);
  const admin = account('ADMIN');
  const manager = account('CONTENT_MANAGER', { createdAt: inWeek(weeks.lastWeek, 5) });
  const accounts = [
    admin,
    manager,
    account('STUDENT', { createdAt: inWeek(weeks.lastWeek, 1) }),
    account('STUDENT', { createdAt: inWeek(weeks.lastWeek, 24 * 6 + 23) }),
    account('STUDENT', { createdAt: inWeek(weeks.weekBefore, 10) }),
    account('STUDENT', { createdAt: inWeek(weeks.thisWeek, 0) }),
  ];
  const h = harness(accounts);
  await assert.rejects(() => h.service.adminNotifications(h.token(manager)), { code: 26 });
  const listed = await h.service.adminNotifications(h.token(admin));
  assert.equal(listed.unread, 1);
  assert.deepEqual(listed.notifications[0].data, { weekStart: weeks.lastWeek, weekEnd: new Date(Date.parse(`${weeks.thisWeek}T00:00:00Z`) - 86400000).toISOString().slice(0, 10), newLearners: 2, change: 1 });
  assert.equal(listed.notifications[0].kind, 'NEW_LEARNERS');
  assert.deepEqual(await h.service.adminMarkNotificationsRead(h.token(admin), []), { unread: 0 });
  assert.equal((await h.service.adminNotifications(h.token(admin))).notifications[0].read, true);
});

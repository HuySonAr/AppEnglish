import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { TokenService } from '../src/auth/token.service.js';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-that-is-long-enough-for-hs256';

function harness(accounts) {
  const revoked = [];
  const audits = [];
  const repo = {
    findAccountById: async (id) => accounts.find((account) => account.id === id) || null,
    listAccounts: async () => ({ items: accounts, total: accounts.length }),
    countActiveAdmins: async () => accounts.filter((account) => account.role === 'ADMIN' && account.status === 'ACTIVE').length,
    createAccount: async (account) => account,
    updateAccountAndAudit: async (account, audit) => { revoked.push(account.id); audits.push(audit); },
  };
  const service = new AuthService(repo, new PasswordService(), new TokenService(), { sendOtp: async () => {} }, new AuthorizationService());
  return { service, token: (account) => service.tokenService.createAccessToken(account), revoked, audits };
}
function account(role, status = 'ACTIVE') {
  return { id: crypto.randomUUID(), email: `${role.toLowerCase()}-${crypto.randomUUID()}@example.com`, role, status, createdAt: new Date(), sessionVersion: 0 };
}

test('ADMIN can list and update safe account fields, audit changes, and revoke sessions', async () => {
  const admin = account('ADMIN');
  const student = account('STUDENT');
  const h = harness([admin, student]);
  const listed = await h.service.adminList(h.token(admin), { page: 1, pageSize: 20 });
  assert.equal(listed.items[0].passwordHash, undefined);
  const updated = await h.service.adminUpdate(h.token(admin), student.id, { role: 'CONTENT_MANAGER', status: 'SUSPENDED' });
  assert.equal(updated.account.role, 'CONTENT_MANAGER');
  assert.deepEqual(h.revoked, [student.id]);
  assert.equal(h.audits[0].actorId, admin.id);
  assert.equal(h.audits[0].previousRole, 'STUDENT');
});

test('STUDENT and CONTENT_MANAGER cannot use admin APIs', async () => {
  for (const role of ['STUDENT', 'CONTENT_MANAGER']) {
    const actor = account(role);
    const h = harness([actor, account('ADMIN')]);
    await assert.rejects(() => h.service.adminList(h.token(actor), { page: 1, pageSize: 20 }), { code: 'FORBIDDEN_ROLE' });
  }
});

test('the last active administrator cannot be demoted or disabled', async () => {
  const admin = account('ADMIN');
  const h = harness([admin]);
  await assert.rejects(() => h.service.adminUpdate(h.token(admin), admin.id, { status: 'DISABLED' }), { code: 23 });
  await assert.rejects(() => h.service.adminUpdate(h.token(admin), admin.id, { role: 'STUDENT' }), { code: 23 });
});

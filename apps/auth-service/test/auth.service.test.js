import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { TokenService } from '../src/auth/token.service.js';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-that-is-long-enough-for-hs256';
process.env.AUTH_ACCESS_TTL = '15m';
process.env.AUTH_REFRESH_TTL = '7d';

function createHarness(accounts = []) {
  const refreshTokens = [];
  const repository = {
    async findByEmail(email) { return accounts.find((account) => account.email === email) || null; },
    async createAccount(account) {
      const created = { id: crypto.randomUUID(), createdAt: new Date(), ...account };
      accounts.push(created);
      return created;
    },
    async findAccountById(id) { return accounts.find((account) => account.id === id) || null; },
    async saveRefreshToken(token) { refreshTokens.push({ id: crypto.randomUUID(), createdAt: new Date(), ...token }); },
    async findRefreshToken(tokenHash) { return refreshTokens.find((token) => token.tokenHash === tokenHash) || null; },
    async revokeRefreshToken(tokenHash, replacedByHash = null) {
      const token = refreshTokens.find((item) => item.tokenHash === tokenHash);
      if (token) { token.revokedAt = new Date(); token.replacedByHash = replacedByHash; }
    },
    async revokeFamily(familyId) {
      refreshTokens.filter((token) => token.familyId === familyId && !token.revokedAt).forEach((token) => { token.revokedAt = new Date(); });
    }
  };
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  return {
    service: new AuthService(repository, passwordService, tokenService),
    passwordService,
    tokenService,
    accounts,
    refreshTokens
  };
}

test('registers a Student account with a one-way password hash and session', async () => {
  const harness = createHarness();
  const result = await harness.service.register({ email: 'Student@Example.com', password: 'correct horse battery staple', role: 'ADMIN' });
  assert.equal(result.account.email, 'student@example.com');
  assert.equal(harness.accounts[0].role, 'STUDENT');
  assert.equal(harness.accounts[0].passwordHash.startsWith('scrypt$'), true);
  assert.equal(result.setCookies.length, 2);
});

test('rejects duplicate accounts and invalid credentials', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'student@example.com', password: 'correct horse battery staple' });
  await assert.rejects(() => harness.service.register({ email: 'student@example.com', password: 'another password' }), { code: 'EMAIL_ALREADY_REGISTERED' });
  await assert.rejects(() => harness.service.login({ email: 'student@example.com', password: 'wrong password' }), { code: 'INVALID_CREDENTIALS' });
});

test('rotates refresh tokens and revokes a family when an old token is reused', async () => {
  const harness = createHarness();
  const account = { id: crypto.randomUUID(), email: 'student@example.com', role: 'STUDENT', status: 'ACTIVE', createdAt: new Date() };
  harness.accounts.push(account);
  const first = harness.tokenService.createRefreshToken(account);
  await harness.service.saveSession(account, first);
  const second = await harness.service.refresh(first.rawToken);
  assert.equal(harness.refreshTokens.length, 2);
  assert.match(second.setCookies[1], /appenglish_refresh=/);
  await assert.rejects(() => harness.service.refresh(first.rawToken), { code: 'REFRESH_TOKEN_REUSE' });
  assert.equal(harness.refreshTokens.every((token) => token.revokedAt), true);
});

test('rejects expired access tokens and disabled accounts', async () => {
  const harness = createHarness();
  const account = { id: crypto.randomUUID(), email: 'disabled@example.com', passwordHash: harness.passwordService.hash('correct horse battery staple'), role: 'STUDENT', status: 'DISABLED', createdAt: new Date() };
  harness.accounts.push(account);
  await assert.rejects(() => harness.service.login({ email: account.email, password: 'wrong password' }), { code: 'INVALID_CREDENTIALS' });
  const expired = harness.tokenService.sign({ sub: account.id, type: 'access', exp: Math.floor(Date.now() / 1000) - 1 });
  await assert.rejects(() => harness.service.me(expired), { code: 'SESSION_EXPIRED' });
  await assert.rejects(() => harness.service.me(harness.tokenService.createAccessToken(account)), { code: 'ACCOUNT_DISABLED' });
});

test('authorizes only explicitly allowed roles', () => {
  const authorization = new AuthorizationService();
  assert.equal(authorization.assertRole({ role: 'ADMIN' }, ['ADMIN']).role, 'ADMIN');
  assert.throws(() => authorization.assertRole({ role: 'STUDENT' }, ['ADMIN']), { code: 'FORBIDDEN_ROLE' });
});

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
  const otps = [];
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
    },
    async countRecentOtps(accountId, purpose, since) { return otps.filter((otp) => otp.accountId === accountId && otp.purpose === purpose && otp.createdAt >= since).length; },
    async findLatestOtp(accountId, purpose) { return otps.filter((otp) => otp.accountId === accountId && otp.purpose === purpose && !otp.usedAt).sort((a, b) => b.createdAt - a.createdAt)[0] || null; },
    async findLatestOtpChallenge(accountId, purpose) { return otps.filter((otp) => otp.accountId === accountId && otp.purpose === purpose).sort((a, b) => b.createdAt - a.createdAt)[0] || null; },
    async invalidateOtps(accountId, purpose) { otps.filter((otp) => otp.accountId === accountId && otp.purpose === purpose).forEach((otp) => { otp.usedAt = new Date(); }); },
    async saveOtp(otp) { otps.push({ id: crypto.randomUUID(), createdAt: new Date(), ...otp }); },
    async updateOtp(id, values) { Object.assign(otps.find((otp) => otp.id === id), values); },
    async revokeAccountSessions(accountId) { refreshTokens.filter((token) => token.accountId === accountId).forEach((token) => { token.revokedAt = new Date(); }); }
  };
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const emailService = { async sendOtp() {} };
  return {
    service: new AuthService(repository, passwordService, tokenService, emailService),
    passwordService,
    tokenService,
    accounts,
    refreshTokens
  };
}

test('registers a Student account as pending and sends one OTP', async () => {
  const harness = createHarness();
  let sent = 0;
  harness.service.emailService.sendOtp = async () => { sent += 1; };
  const result = await harness.service.register({ email: 'Student@Example.com', password: 'correct horse battery staple', role: 'ADMIN' });
  assert.equal(result.code, 1);
  assert.equal(result.msg, 'additional');
  assert.equal(result.data.nextAction, 'VERIFY_EMAIL');
  assert.equal(result.data.email, 'student@example.com');
  assert.equal(harness.accounts.length, 1);
  assert.equal(harness.accounts[0].role, 'STUDENT');
  assert.equal(harness.accounts[0].status, 'PENDING_VERIFICATION');
  assert.equal(harness.accounts[0].passwordHash.startsWith('scrypt$'), true);
  assert.equal(sent, 1);
});

test('resuming a pending registration keeps the account and does not resend the OTP', async () => {
  const harness = createHarness();
  let sent = 0;
  harness.service.emailService.sendOtp = async () => { sent += 1; };
  await harness.service.register({ email: 'pending@example.com', password: 'correct horse battery staple' });
  const firstHash = harness.accounts[0].passwordHash;
  const result = await harness.service.register({ email: 'Pending@Example.com', password: 'a different password' });
  assert.equal(result.code, 1);
  assert.equal(result.msg, 'additional');
  assert.equal(result.data.nextAction, 'VERIFY_EMAIL');
  assert.equal(result.data.email, 'pending@example.com');
  assert.equal(harness.accounts.length, 1);
  assert.equal(harness.accounts[0].passwordHash, firstHash);
  assert.equal(sent, 1);
});

test('registering an active email is rejected without account, session or OTP', async () => {
  const harness = createHarness();
  let sent = 0;
  harness.service.emailService.sendOtp = async () => { sent += 1; };
  await harness.service.register({ email: 'student@example.com', password: 'correct horse battery staple' });
  harness.accounts[0].status = 'ACTIVE';
  await assert.rejects(() => harness.service.register({ email: 'student@example.com', password: 'another password' }), { code: 19 });
  assert.equal(harness.accounts.length, 1);
  assert.equal(harness.refreshTokens.length, 0);
  assert.equal(sent, 1);
});

test('login with wrong password on a pending account hides the verification state', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'hide@example.com', password: 'correct horse battery staple' });
  await assert.rejects(() => harness.service.login({ email: 'hide@example.com', password: 'wrong password' }), { code: 10 });
  await assert.rejects(
    () => harness.service.login({ email: 'hide@example.com', password: 'correct horse battery staple' }),
    (error) => error.code === 13 && error.nextAction === 'VERIFY_EMAIL'
  );
});

test('requires email verification before login and creates a session after OTP verification', async () => {
  const harness = createHarness();
  const result = await harness.service.register({ email: 'verify@example.com', password: 'correct horse battery staple' });
  assert.equal(result.code, 1);
  await assert.rejects(() => harness.service.login({ email: 'verify@example.com', password: 'correct horse battery staple' }), { code: 13 });
  const account = harness.accounts[0];
  const otp = harness.service.otpHash(account.id, 'VERIFY_EMAIL', '123456');
  await harness.service.accountRepository.saveOtp({ accountId: account.id, purpose: 'VERIFY_EMAIL', codeHash: otp, expiresAt: new Date(Date.now() + 300000), resendAfter: new Date() });
  const session = await harness.service.verifyEmail({ email: account.email, otp: '123456' });
  assert.equal(session.account.status, 'ACTIVE');
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
  await assert.rejects(() => harness.service.refresh(first.rawToken), { code: 20 });
  assert.equal(harness.refreshTokens.every((token) => token.revokedAt), true);
});

test('rejects expired access tokens and disabled accounts', async () => {
  const harness = createHarness();
  const account = { id: crypto.randomUUID(), email: 'disabled@example.com', passwordHash: harness.passwordService.hash('correct horse battery staple'), role: 'STUDENT', status: 'DISABLED', createdAt: new Date() };
  harness.accounts.push(account);
  await assert.rejects(() => harness.service.login({ email: account.email, password: 'wrong password' }), { code: 10 });
  const expired = harness.tokenService.sign({ sub: account.id, type: 'access', exp: Math.floor(Date.now() / 1000) - 1 });
  await assert.rejects(() => harness.service.me(expired), { code: 21 });
  await assert.rejects(() => harness.service.me(harness.tokenService.createAccessToken(account)), { code: 14 });
});

test('disabled and suspended accounts cannot log in or verify an OTP', async () => {
  const harness = createHarness();
  const passwordHash = harness.passwordService.hash('correct horse battery staple');
  const disabled = { id: crypto.randomUUID(), email: 'disabled2@example.com', passwordHash, role: 'STUDENT', status: 'DISABLED', createdAt: new Date() };
  const suspended = { id: crypto.randomUUID(), email: 'suspended@example.com', passwordHash, role: 'STUDENT', status: 'SUSPENDED', createdAt: new Date() };
  harness.accounts.push(disabled, suspended);
  await assert.rejects(() => harness.service.login({ email: disabled.email, password: 'correct horse battery staple' }), { code: 14 });
  await assert.rejects(() => harness.service.login({ email: suspended.email, password: 'correct horse battery staple' }), { code: 22 });
  await assert.rejects(() => harness.service.verifyEmail({ email: disabled.email, otp: '123456' }), { code: 14 });
  await assert.rejects(() => harness.service.verifyEmail({ email: suspended.email, otp: '123456' }), { code: 22 });
  assert.equal(disabled.status, 'DISABLED');
  assert.equal(suspended.status, 'SUSPENDED');
  assert.equal(harness.refreshTokens.length, 0);
});

test('wrong OTP is rejected and a valid OTP activates the account once', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'otp@example.com', password: 'correct horse battery staple' });
  const account = harness.accounts[0];
  const challenge = await harness.service.accountRepository.findLatestOtp(account.id, 'VERIFY_EMAIL');
  await harness.service.accountRepository.updateOtp(challenge.id, { codeHash: harness.service.otpHash(account.id, 'VERIFY_EMAIL', '123456') });
  await assert.rejects(() => harness.service.verifyEmail({ email: account.email, otp: '654321' }), { code: 15 });
  assert.equal(harness.refreshTokens.length, 0);
  const session = await harness.service.verifyEmail({ email: account.email, otp: '123456' });
  assert.equal(session.account.status, 'ACTIVE');
  assert.equal(harness.refreshTokens.length, 1);
  // Re-submitting the old OTP for the now verified account directs to login
  // without creating a second session.
  const again = await harness.service.verifyEmail({ email: account.email, otp: '123456' });
  assert.equal(again.code, 1);
  assert.equal(again.data.nextAction, 'LOGIN');
  assert.equal(harness.refreshTokens.length, 1);
});

test('an OTP challenge is single-use at the verification level', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'single-use@example.com', password: 'correct horse battery staple' });
  const account = harness.accounts[0];
  const challenge = await harness.service.accountRepository.findLatestOtp(account.id, 'VERIFY_EMAIL');
  await harness.service.accountRepository.updateOtp(challenge.id, { codeHash: harness.service.otpHash(account.id, 'VERIFY_EMAIL', '123456') });
  await harness.service.verifyOtp(account, 'VERIFY_EMAIL', '123456');
  assert.ok(challenge.usedAt);
  await assert.rejects(() => harness.service.verifyOtp(account, 'VERIFY_EMAIL', '123456'), { code: 15 });
});

test('verify-email for an already verified account returns LOGIN guidance without a session', async () => {
  const harness = createHarness();
  harness.accounts.push({ id: crypto.randomUUID(), email: 'verified@example.com', passwordHash: harness.passwordService.hash('correct horse battery staple'), role: 'STUDENT', status: 'ACTIVE', emailVerifiedAt: new Date(), createdAt: new Date() });
  const result = await harness.service.verifyEmail({ email: 'verified@example.com', otp: '123456' });
  assert.equal(result.code, 1);
  assert.equal(result.data.nextAction, 'LOGIN');
  assert.equal(result.data.email, 'verified@example.com');
  assert.equal(harness.refreshTokens.length, 0);
});

test('expired OTP is rejected without activating the account', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'expired@example.com', password: 'correct horse battery staple' });
  const account = harness.accounts[0];
  const challenge = await harness.service.accountRepository.findLatestOtp(account.id, 'VERIFY_EMAIL');
  await harness.service.accountRepository.updateOtp(challenge.id, { expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(() => harness.service.verifyEmail({ email: account.email, otp: '123456' }), { code: 16 });
  assert.equal(account.status, 'PENDING_VERIFICATION');
  assert.equal(harness.refreshTokens.length, 0);
});

test('resend verification does not create a session for an active account', async () => {
  const harness = createHarness();
  harness.accounts.push({ id: crypto.randomUUID(), email: 'active@example.com', passwordHash: harness.passwordService.hash('correct horse battery staple'), role: 'STUDENT', status: 'ACTIVE', emailVerifiedAt: new Date(), createdAt: new Date() });
  const result = await harness.service.resendVerification('active@example.com');
  assert.equal(result.code, 1);
  assert.equal(result.data.nextAction, 'LOGIN');
  assert.equal(harness.refreshTokens.length, 0);
});

test('resend verification for a pending account issues a replacement OTP without a session', async () => {
  const harness = createHarness();
  let sent = 0;
  harness.service.emailService.sendOtp = async () => { sent += 1; };
  await harness.service.register({ email: 'pending@example.com', password: 'correct horse battery staple' });
  const account = harness.accounts[0];
  const latest = await harness.service.accountRepository.findLatestOtp(account.id, 'VERIFY_EMAIL');
  await harness.service.accountRepository.updateOtp(latest.id, { resendAfter: new Date(Date.now() - 1000) });
  const result = await harness.service.resendVerification('pending@example.com');
  assert.equal(result.code, 1);
  assert.equal(result.data.nextAction, 'VERIFY_EMAIL');
  assert.equal(sent, 2);
  assert.equal(harness.refreshTokens.length, 0);
});

test('resend verification inside the cooldown is rate limited by the backend', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'cooldown@example.com', password: 'correct horse battery staple' });
  await assert.rejects(() => harness.service.resendVerification('cooldown@example.com'), { code: 18 });
});

test('authorizes only explicitly allowed roles', () => {
  const authorization = new AuthorizationService();
  assert.equal(authorization.assertRole({ role: 'ADMIN' }, ['ADMIN']).role, 'ADMIN');
  assert.throws(() => authorization.assertRole({ role: 'STUDENT' }, ['ADMIN']), { code: 'FORBIDDEN_ROLE' });
});

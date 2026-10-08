import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PasswordService } from '../src/auth/password.service.js';

function createHarness(accounts = []) {
  const repository = {
    async findByEmail(email) { return accounts.find((account) => account.email === email) || null; },
    async createAccount(account) {
      const created = { id: crypto.randomUUID(), createdAt: new Date(), ...account };
      accounts.push(created);
      return created;
    }
  };
  const passwordService = new PasswordService();
  return { service: new AuthService(repository, passwordService), passwordService, accounts };
}

test('registers a student account with a one-way password hash', async () => {
  const harness = createHarness();
  const result = await harness.service.register({ email: 'Student@Example.com', password: 'correct horse battery staple', role: 'STUDENT' });
  assert.equal(result.account?.email ?? result.email, 'student@example.com');
  assert.equal(harness.accounts[0].passwordHash.startsWith('scrypt$'), true);
  assert.equal(harness.accounts[0].passwordHash.includes('correct horse'), false);
});

test('rejects duplicate accounts and invalid credentials', async () => {
  const harness = createHarness();
  await harness.service.register({ email: 'student@example.com', password: 'correct horse battery staple', role: 'STUDENT' });
  await assert.rejects(
    () => harness.service.register({ email: 'student@example.com', password: 'another password', role: 'STUDENT' }),
    { code: 'EMAIL_ALREADY_REGISTERED' }
  );
  await assert.rejects(
    () => harness.service.login({ email: 'student@example.com', password: 'wrong password' }),
    { code: 'INVALID_CREDENTIALS' }
  );
});

test('rejects disabled accounts before authentication succeeds', async () => {
  const passwordService = new PasswordService();
  const account = {
    id: crypto.randomUUID(),
    email: 'disabled@example.com',
    passwordHash: passwordService.hash('correct horse battery staple'),
    role: 'STUDENT',
    status: 'DISABLED',
    createdAt: new Date()
  };
  const harness = createHarness([account]);
  await assert.rejects(
    () => harness.service.login({ email: account.email, password: 'correct horse battery staple' }),
    { code: 'ACCOUNT_DISABLED' }
  );
});

test('authorizes only explicitly allowed roles', () => {
  const authorization = new AuthorizationService();
  assert.equal(authorization.assertRole({ role: 'ADMIN' }, ['ADMIN']).role, 'ADMIN');
  assert.throws(() => authorization.assertRole({ role: 'STUDENT' }, ['ADMIN']), { code: 'FORBIDDEN_ROLE' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { AuthController } from '../src/auth/auth.controller.js';
import { authErrors } from '../src/auth/auth.errors.js';

const account = {
  id: '2f4d3b6a-1c2e-4f60-9b1d-8a7c5e2f9d10',
  email: 'student@example.com',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-10-09T00:00:00.000Z'
};

const sessionPayload = {
  account,
  authenticated: true,
  authentication: 'session',
  setCookies: [
    'appenglish_access=access-token; Max-Age=900; Path=/; HttpOnly; SameSite=Lax',
    'appenglish_refresh=refresh-token; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax'
  ]
};

function createController(overrides = {}) {
  const authService = {
    async register() { return { code: 1, msg: 'additional', data: { nextAction: 'VERIFY_EMAIL', email: 'student@example.com' } }; },
    async login() { return sessionPayload; },
    async verifyEmail() { return sessionPayload; },
    async resendVerification() { return { code: 1, msg: 'additional', data: { nextAction: 'VERIFY_EMAIL', email: 'student@example.com', expiresInSeconds: 300, resendAfterSeconds: 60 } }; },
    async forgotPassword() { return { code: 1, msg: 'additional', data: { nextAction: 'RESET_PASSWORD', email: 'student@example.com', expiresInSeconds: 300, resendAfterSeconds: 60 } }; },
    async resetPassword() { return { code: 0, msg: 'success', data: {} }; },
    ...overrides
  };
  return new AuthController(authService);
}

function createResponse() {
  const headers = {};
  return { headers, setHeader(name, value) { headers[name] = value; } };
}

test('register returns a single additional envelope for a pending email', async () => {
  const controller = createController();
  const body = await controller.register({ email: 'Student@Example.com', password: 'correct horse battery staple' });
  assert.equal(body.code, 1);
  assert.equal(body.msg, 'additional');
  assert.equal(body.data.nextAction, 'VERIFY_EMAIL');
  assert.equal(body.data.email, 'student@example.com');
  assert.equal('code' in body.data, false);
  assert.equal('msg' in body.data, false);
});

test('login emits session cookies and keeps the account in the body', async () => {
  const controller = createController();
  const response = createResponse();
  const body = await controller.login({ email: 'student@example.com', password: 'correct horse battery staple' }, response);
  assert.equal(body.code, 0);
  assert.equal(body.data.account.role, 'STUDENT');
  assert.equal('setCookies' in body.data, false);
  assert.equal(response.headers['Set-Cookie'].length, 2);
  assert.match(response.headers['Set-Cookie'][0], /appenglish_access=/);
  assert.match(response.headers['Set-Cookie'][1], /appenglish_refresh=/);
});

test('login for an unverified account fails with 403 and VERIFY_EMAIL guidance', async () => {
  const controller = createController({ async login() { throw authErrors.emailNotVerified(); } });
  await assert.rejects(
    () => controller.login({ email: 'student@example.com', password: 'correct horse battery staple' }, createResponse()),
    (error) => {
      assert.equal(error instanceof HttpException, true);
      assert.equal(error.getStatus(), 403);
      assert.deepEqual(error.getResponse(), { code: 13, msg: 'fail', data: { nextAction: 'VERIFY_EMAIL' } });
      return true;
    }
  );
});

test('wrong credentials fail without verification guidance', async () => {
  const controller = createController({ async login() { throw authErrors.invalidCredentials(); } });
  await assert.rejects(
    () => controller.login({ email: 'student@example.com', password: 'wrong password' }, createResponse()),
    (error) => {
      assert.equal(error.getStatus(), 401);
      assert.deepEqual(error.getResponse(), { code: 10, msg: 'fail', data: {} });
      return true;
    }
  );
});

test('verify-email for an already verified account returns LOGIN guidance without cookies', async () => {
  const controller = createController({
    async verifyEmail() { return { code: 1, msg: 'additional', data: { nextAction: 'LOGIN', email: 'student@example.com' } }; }
  });
  const response = createResponse();
  const body = await controller.verifyEmail({ email: 'student@example.com', otp: '123456' }, response);
  assert.equal(body.code, 1);
  assert.equal(body.data.nextAction, 'LOGIN');
  assert.equal(response.headers['Set-Cookie'], undefined);
});

test('verify-email success relays the session cookies', async () => {
  const controller = createController();
  const response = createResponse();
  const body = await controller.verifyEmail({ email: 'student@example.com', otp: '123456' }, response);
  assert.equal(body.data.account.role, 'STUDENT');
  assert.equal('setCookies' in body.data, false);
  assert.equal(response.headers['Set-Cookie'].length, 2);
});

test('resend and forgot-password return their additional envelopes unchanged', async () => {
  const controller = createController();
  const resend = await controller.resendVerification({ email: 'student@example.com' });
  assert.equal(resend.code, 1);
  assert.equal(resend.data.nextAction, 'VERIFY_EMAIL');
  assert.equal(resend.data.resendAfterSeconds, 60);
  const forgot = await controller.forgotPassword({ email: 'student@example.com' });
  assert.equal(forgot.code, 1);
  assert.equal(forgot.data.nextAction, 'RESET_PASSWORD');
  assert.equal(forgot.data.resendAfterSeconds, 60);
});

test('resend-verification rejects a missing email with the 400 validation envelope', async () => {
  const controller = createController();
  await assert.rejects(() => controller.resendVerification({}), (error) => {
    assert.equal(error instanceof HttpException, true);
    assert.equal(error.getStatus(), 400);
    assert.equal(error.getResponse().code, 30);
    return true;
  });
});

test('admin detail/update map auth and validation errors to their HTTP envelopes', async () => {
  const accessToken = 'access-token';
  const controller = createController({
    async adminGet() { throw authErrors.forbiddenRole(); },
    async adminUpdate() { throw authErrors.lastAdmin(); }
  });
  await assert.rejects(() => controller.adminGet(account.id, accessToken), (error) => {
    assert.equal(error.getStatus(), 403);
    assert.deepEqual(error.getResponse(), { code: 26, msg: 'fail', data: {} });
    return true;
  });
  await assert.rejects(() => controller.adminUpdate(account.id, { status: 'DISABLED' }, accessToken), (error) => {
    assert.equal(error.getStatus(), 409);
    assert.equal(error.getResponse().code, 23);
    return true;
  });
  for (const call of [
    () => controller.adminGet('not-a-uuid', accessToken),
    () => controller.adminUpdate(account.id, {}, accessToken)
  ]) {
    await assert.rejects(call, (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(error.getResponse().code, 30);
      return true;
    });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ResponseCode } from '@appenglish/auth-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import {
  accountFromEnvelope,
  accountHasRole,
  dashboardPathForRole,
  verifyOtpAndRestoreSession
} from './auth-flow.js';

// Mirrors the envelope returned by auth-service through the gateway:
// httpClient.post(...).data === { code, msg, data }.
function envelope(data, code = ResponseCode.SUCCESS) {
  return { code, msg: code === ResponseCode.SUCCESS ? 'success' : 'fail', data };
}

function sessionEnvelope(role = 'STUDENT') {
  return envelope({
    account: {
      id: '2f4d3b6a-1c2e-4f60-9b1d-8a7c5e2f9d10',
      email: 'student@example.com',
      role,
      status: 'ACTIVE',
      createdAt: '2026-10-09T00:00:00.000Z'
    },
    authenticated: true,
    authentication: 'session'
  });
}

test('reads the account from the auth envelope returned by auth-api', () => {
  const account = accountFromEnvelope(sessionEnvelope('STUDENT'));
  assert.equal(account.role, 'STUDENT');
});

test('returns null instead of an authenticated state without an account', () => {
  assert.equal(accountFromEnvelope(envelope({})), null);
  assert.equal(accountFromEnvelope(undefined), null);
});

test('maps canonical roles to dashboard routes used by guards', () => {
  assert.equal(dashboardPathForRole('STUDENT'), '/student');
  assert.equal(dashboardPathForRole('CONTENT_MANAGER'), '/content-manager');
  assert.equal(dashboardPathForRole('ADMIN'), '/admin');
});

test('valid OTP with a backend session produces one successful outcome', async () => {
  const calls = { verify: 0, restore: 0 };
  const result = await verifyOtpAndRestoreSession({
    verifyEmail: async () => { calls.verify += 1; return sessionEnvelope('STUDENT'); },
    restoreSession: async () => { calls.restore += 1; return accountFromEnvelope(sessionEnvelope('STUDENT')); }
  });
  assert.equal(calls.verify, 1);
  assert.equal(calls.restore, 1);
  assert.equal(result.account.role, 'STUDENT');
  assert.equal(result.restoredAccount.role, 'STUDENT');
});

test('invalid, expired or reused OTP keeps its own error and never loads a session', async () => {
  for (const code of [
    ResponseCode.AUTH_OTP_INVALID,
    ResponseCode.AUTH_OTP_EXPIRED,
    ResponseCode.AUTH_OTP_ATTEMPTS_EXCEEDED
  ]) {
    let restoreCalls = 0;
    const otpError = Object.assign(new Error('otp failed'), {
      response: { status: 400, data: { code, msg: 'fail', data: {} } }
    });
    await assert.rejects(
      () => verifyOtpAndRestoreSession({
        verifyEmail: async () => { throw otpError; },
        restoreSession: async () => { restoreCalls += 1; return null; }
      }),
      (error) => error === otpError
    );
    assert.equal(restoreCalls, 0);
    assert.equal(getApiErrorMessage(otpError).includes('code'), true);
  }
});

test('failed session load after a successful verify is reported separately from OTP errors', async () => {
  const result = await verifyOtpAndRestoreSession({
    verifyEmail: async () => sessionEnvelope('STUDENT'),
    restoreSession: async () => null
  });
  assert.equal(result.account.role, 'STUDENT');
  assert.equal(result.restoredAccount, null);
  const sessionError = { response: { status: 401, data: { code: ResponseCode.AUTH_SESSION_EXPIRED, msg: 'fail', data: {} } } };
  assert.equal(getApiErrorMessage(sessionError), 'Your session has expired. Please sign in again.');
});

test('a Student session matches the Student route guard', () => {
  const student = accountFromEnvelope(sessionEnvelope('STUDENT'));
  assert.equal(accountHasRole(student, 'STUDENT'), true);
  assert.equal(dashboardPathForRole(student.role), '/student');
});

test('role guard still blocks missing accounts and other roles', () => {
  assert.equal(accountHasRole(null, 'STUDENT'), false);
  assert.equal(accountHasRole(undefined, 'STUDENT'), false);
  assert.equal(accountHasRole(accountFromEnvelope(sessionEnvelope('CONTENT_MANAGER')), 'STUDENT'), false);
  assert.equal(accountHasRole(accountFromEnvelope(sessionEnvelope('ADMIN')), 'ADMIN'), true);
});

test('unverified and locked accounts map to distinct login errors', () => {
  const unverified = { response: { status: 403, data: { code: ResponseCode.AUTH_EMAIL_NOT_VERIFIED, msg: 'fail', data: {} } } };
  const disabled = { response: { status: 403, data: { code: ResponseCode.AUTH_ACCOUNT_DISABLED, msg: 'fail', data: {} } } };
  const suspended = { response: { status: 403, data: { code: ResponseCode.AUTH_ACCOUNT_SUSPENDED, msg: 'fail', data: {} } } };
  assert.equal(getApiErrorMessage(unverified), 'Verify your email before signing in.');
  assert.equal(getApiErrorMessage(disabled), 'This account is disabled.');
  assert.equal(getApiErrorMessage(suspended), 'This account is suspended.');
});

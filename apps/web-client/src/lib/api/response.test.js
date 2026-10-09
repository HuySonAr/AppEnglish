import test from 'node:test';
import assert from 'node:assert/strict';
import { ResponseCode } from '@appenglish/auth-contracts';
import { errorCode, errorNextAction, getApiErrorMessage, isUnauthorizedError, responseCode, responseData } from './response.js';

test('reads the shared auth response envelope', () => {
  const response = { data: { code: ResponseCode.SUCCESS, msg: 'success', data: { account: { role: 'STUDENT' } } } };
  assert.equal(responseCode(response), ResponseCode.SUCCESS);
  assert.deepEqual(responseData(response), { account: { role: 'STUDENT' } });
});

test('maps backend auth errors without assuming a message-only response', () => {
  assert.equal(getApiErrorMessage({ response: { data: { code: ResponseCode.AUTH_EMAIL_NOT_VERIFIED, msg: 'fail', data: {} } } }), 'Verify your email before signing in.');
  assert.equal(getApiErrorMessage({ response: { data: { code: 999, msg: 'fail', data: {} } } }), 'Something went wrong. Please try again.');
});

test('reads the numeric code and nextAction from error envelopes', () => {
  const unverified = { response: { status: 403, data: { code: ResponseCode.AUTH_EMAIL_NOT_VERIFIED, msg: 'fail', data: { nextAction: 'VERIFY_EMAIL' } } } };
  assert.equal(errorCode(unverified), ResponseCode.AUTH_EMAIL_NOT_VERIFIED);
  assert.equal(errorNextAction(unverified), 'VERIFY_EMAIL');
  assert.equal(errorNextAction({ response: { status: 401, data: { code: ResponseCode.AUTH_INVALID_CREDENTIALS, msg: 'fail', data: {} } } }), null);
  assert.equal(errorNextAction(new Error('network down')), null);
});

test('recognizes expired sessions from status or shared response code', () => {
  assert.equal(isUnauthorizedError({ response: { status: 401 } }), true);
  assert.equal(isUnauthorizedError({ response: { data: { code: ResponseCode.AUTH_SESSION_EXPIRED } } }), true);
  assert.equal(isUnauthorizedError({ response: { status: 403 } }), false);
});

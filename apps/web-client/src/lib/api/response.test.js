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

test('an answer without a code never borrows another message', () => {
  assert.equal(getApiErrorMessage({ message: 'socket hang up' }), 'Could not reach the server. Check your connection and try again.');
  assert.equal(getApiErrorMessage({ response: { status: 500, data: { statusCode: 500, message: 'Internal server error' } } }), 'Something went wrong. Please try again.');
  assert.equal(getApiErrorMessage({ response: { status: 502, data: '<html>bad gateway</html>' } }), 'Something went wrong. Please try again.');
});

test('a content state refusal explains its reason (D191, D193)', () => {
  const refused = (reason) => ({ response: { status: 409, data: { code: 41, data: reason ? { reason } : {} } } });
  assert.equal(getApiErrorMessage(refused('PUBLISHED_BEFORE')), 'This is not allowed once it has been published.');
  assert.equal(getApiErrorMessage(refused('PENDING_REVIEW')), 'It is waiting for review. Withdraw it first to change it.');
  assert.equal(getApiErrorMessage(refused()), 'There is no draft to publish.');
});

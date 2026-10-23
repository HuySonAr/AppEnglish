import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MemorySessionStore, SessionResolver, verifyAccessToken } from '../src/auth/session-cache.js';

const SECRET = 'a-test-secret-that-is-long-enough-123';
const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(claims, secret = SECRET) {
  const head = part({ alg: 'HS256', typ: 'JWT' });
  const body = part(claims);
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}
const NOW = 1_800_000_000;

test('the gateway checks the signature, the type and the expiry of an access token itself', () => {
  const good = token({ sub: 'a1', type: 'access', exp: NOW + 600 });
  assert.equal(verifyAccessToken(good, SECRET, NOW).sub, 'a1');
  assert.equal(verifyAccessToken(token({ sub: 'a1', type: 'access', exp: NOW + 600 }, 'another-secret-another-secret-12'), SECRET, NOW), null);
  assert.equal(verifyAccessToken(token({ sub: 'a1', type: 'access', exp: NOW - 1 }), SECRET, NOW), null);
  assert.equal(verifyAccessToken(token({ sub: 'a1', type: 'refresh', exp: NOW + 600 }), SECRET, NOW), null);
  assert.equal(verifyAccessToken('student', SECRET, NOW), null);
});

test('a valid session is asked to auth-service once, then served from the cache for 30 seconds', async () => {
  let clock = NOW * 1000;
  const calls = [];
  const auth = {
    Me: (message) => ({
      subscribe: ({ next }) => {
        calls.push(message.accessToken);
        next(message.accessToken === 'locked'
          ? { httpStatus: 401, code: 21, msg: 'fail', dataJson: '{}' }
          : { httpStatus: 200, code: 0, msg: 'success', dataJson: JSON.stringify({ account: { id: 'a1', role: 'STUDENT', email: 'a@x.test' } }) });
      },
    }),
  };
  const resolver = new SessionResolver({ store: new MemorySessionStore({ now: () => clock }), secret: SECRET, now: () => clock });
  const good = token({ sub: 'a1', type: 'access', exp: NOW + 600 });
  const request = (value) => ({ headers: { cookie: `appenglish_access=${value}` } });
  assert.deepEqual(await resolver.resolve(auth, request(good)), { id: 'a1', role: 'STUDENT', email: 'a@x.test' });
  await resolver.resolve(auth, request(good));
  assert.equal(calls.length, 1);
  clock += 31_000;
  await resolver.resolve(auth, request(good));
  assert.equal(calls.length, 2, 'after 30 seconds auth-service is asked again, so a locked account is refused soon');
  await resolver.resolve(auth, request('not-a-jwt'));
  await resolver.resolve(auth, request('not-a-jwt'));
  assert.equal(calls.length, 4, 'a token the gateway cannot check is never cached');
  await assert.rejects(() => resolver.resolve(auth, request('locked')), (error) => error.getStatus() === 401);
});

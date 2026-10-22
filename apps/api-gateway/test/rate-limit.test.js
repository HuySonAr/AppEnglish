import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Controller, Module, Post, Get } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { RateLimitGuard, decide } from '../src/rate-limit/rate-limit.guard.js';
import { clientIp, emailOf, keysFor, normalizePath, policiesFor, RateLimitScope } from '../src/rate-limit/rate-limit.policies.js';
import { MemoryRateLimitStore, RATE_LIMIT_STORE, createRateLimitStore } from '../src/rate-limit/rate-limit.store.js';

test('policies are picked by method and path; health is never limited by the guard', () => {
  assert.deepEqual(policiesFor('POST', '/auth/login?x=1').map((policy) => policy.scope), [RateLimitScope.LOGIN, RateLimitScope.GLOBAL]);
  assert.deepEqual(policiesFor('post', '/auth/forgot-password/').map((policy) => policy.scope), [RateLimitScope.OTP, RateLimitScope.GLOBAL]);
  assert.deepEqual(policiesFor('GET', '/auth/login').map((policy) => policy.scope), [RateLimitScope.GLOBAL]);
  assert.deepEqual(policiesFor('POST', '/content/media').map((policy) => policy.scope), [RateLimitScope.UPLOAD, RateLimitScope.GLOBAL]);
  assert.equal(normalizePath('/'), '/');
});

test('keys combine the address with a hashed email; without an email only the address rule counts', () => {
  const [login] = policiesFor('POST', '/auth/login');
  const request = { ip: '203.0.113.9', body: { email: ' Minh.Anh@Example.com ' } };
  const keys = keysFor(login, request);
  assert.equal(keys.length, 2);
  assert.match(keys[0].key, /^rl:login:ip\+email:203\.0\.113\.9:[0-9a-f]{16}$/);
  assert.equal(keys[0].key.includes('example.com'), false);
  assert.equal(keys[1].key, 'rl:login:ip:203.0.113.9');
  assert.deepEqual([keys[0].limit, keys[1].limit], [10, 30]);
  // Same email, different case: the same key.
  assert.equal(keysFor(login, { ip: '203.0.113.9', body: { email: 'minh.anh@example.com' } })[0].key, keys[0].key);
  assert.equal(keysFor(login, { ip: '203.0.113.9', body: {} }).length, 1);
  assert.equal(emailOf({ body: { email: 42 } }), '');
  assert.equal(clientIp({ socket: { remoteAddress: '10.0.0.1' } }), '10.0.0.1');
  assert.equal(clientIp({}), 'unknown');
});

test('the memory store counts per fixed window and forgets expired windows', async () => {
  let now = 1_000_000;
  const store = new MemoryRateLimitStore({ now: () => now });
  assert.deepEqual(await store.hit('a', 1000), { count: 1, resetAt: 1_001_000 });
  assert.deepEqual(await store.hit('a', 1000), { count: 2, resetAt: 1_001_000 });
  now = 1_001_000;
  assert.deepEqual(await store.hit('a', 1000), { count: 1, resetAt: 1_002_000 });
  now += 61_000;
  await store.hit('b', 1000);
  assert.equal(store.windows.has('a'), false);
});

test('the decision reports the first key over its limit with the wait', () => {
  const now = Date.now();
  assert.deepEqual(decide([{ count: 3, limit: 10, resetAt: now + 5000 }]), { allowed: true });
  const refused = decide([
    { scope: 'login', count: 11, limit: 10, resetAt: now + 90_000 },
    { scope: 'global', count: 400, limit: 300, resetAt: now + 1000 },
  ]);
  assert.equal(refused.allowed, false);
  assert.equal(refused.scope, 'login');
  assert.ok(refused.retryAfterSeconds >= 89 && refused.retryAfterSeconds <= 90);
});

test('the store factory follows the environment', () => {
  assert.ok(createRateLimitStore({}) instanceof MemoryRateLimitStore);
  assert.equal(createRateLimitStore({ REDIS_URL: 'redis://localhost:6379' }).constructor.name, 'RedisRateLimitStore');
  assert.ok(createRateLimitStore({ REDIS_URL: 'redis://x', RATE_LIMIT_STORE: 'memory' }) instanceof MemoryRateLimitStore);
  assert.throws(() => createRateLimitStore({ RATE_LIMIT_STORE: 'redis' }), /REDIS_URL/);
  assert.throws(() => createRateLimitStore({ RATE_LIMIT_STORE: 'disk' }), /Unsupported/);
});

test('over HTTP the guard answers 429 with the envelope and Retry-After, passes health, and fails open', async (t) => {
  class ProbeController {
    login() { return { code: 0, msg: 'success', data: {} }; }
    health() { return { status: 'ok' }; }
  }
  Controller()(ProbeController);
  Post('auth/login')(ProbeController.prototype, 'login', Object.getOwnPropertyDescriptor(ProbeController.prototype, 'login'));
  Get('health')(ProbeController.prototype, 'health', Object.getOwnPropertyDescriptor(ProbeController.prototype, 'health'));

  const store = new MemoryRateLimitStore();
  let broken = false;
  const flaky = { hit: (key, windowMs) => (broken ? Promise.reject(new Error('redis down')) : store.hit(key, windowMs)) };
  class TestModule {}
  Module({
    controllers: [ProbeController],
    providers: [{ provide: RATE_LIMIT_STORE, useValue: flaky }, { provide: APP_GUARD, useClass: RateLimitGuard }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const login = (email) => fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'x' }) });

  for (let index = 0; index < 10; index += 1) assert.equal((await login('a@example.com')).status, 201);
  const refused = await login('a@example.com');
  assert.equal(refused.status, 429);
  assert.ok(Number(refused.headers.get('retry-after')) > 0);
  const body = await refused.json();
  assert.equal(body.code, 33);
  assert.equal(body.msg, 'fail');
  assert.equal(body.data.scope, 'login');
  assert.equal(body.data.limit, 10);
  // Another email from the same address is still allowed (the per-address limit is 30).
  assert.equal((await login('b@example.com')).status, 201);
  // Health is never counted.
  for (let index = 0; index < 5; index += 1) assert.equal((await fetch(`${base}/health`)).status, 200);
  // A failing store lets requests through.
  broken = true;
  assert.equal((await login('a@example.com')).status, 201);
});

import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { authGrpcOptions } from '@appenglish/auth-contracts/grpc';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthGrpcController } from '../src/auth/auth.grpc.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { authErrors } from '../src/auth/auth.errors.js';
import { AUTH_DATA_SOURCE } from '../src/database/database.tokens.js';
import { AUTH_GRPC_CLIENT, AuthGatewayController } from '../../api-gateway/src/auth/auth-gateway.controller.js';
import { HealthController } from '../../api-gateway/src/health/health.controller.js';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

test('Gateway HTTP to auth-service gRPC contract', async (t) => {
  let repositoryCalls = 0;
  let lastQuery;
  const fixture = {
    id: '2f4d3b6a-1c2e-4f60-9b1d-8a7c5e2f9d10',
    email: 'fixture@example.com', role: 'STUDENT', status: 'ACTIVE',
    createdAt: new Date('2026-10-09T00:00:00Z'),
  };
  let actorRole = 'ADMIN';
  const service = new AuthService({
    async listAccounts(query) {
      repositoryCalls++;
      lastQuery = query;
      return { items: [fixture], total: 1 };
    },
    async findAccountById(id) { return id === fixture.id ? fixture : null; },
  }, undefined, undefined, undefined, new AuthorizationService());
  // Session validation and credential checks are isolated; the handlers,
  // schemas, mapper, authorization, gRPC transport and gateway HTTP server are
  // real. No database, credentials or real tokens are used.
  const seen = {};
  service.me = async (accessToken) => {
    seen.accessToken = accessToken;
    if (!accessToken) throw authErrors.sessionExpired();
    return { account: { id: fixture.id, role: actorRole } };
  };
  service.login = async (input) => {
    seen.login = { email: input.email, password: input.password };
    return { account: { ...fixture, createdAt: fixture.createdAt.toISOString() }, authenticated: true, authentication: 'session', setCookies: ['appenglish_access=a; HttpOnly', 'appenglish_refresh=r; HttpOnly'] };
  };
  service.logout = async (refreshToken) => {
    seen.refreshToken = refreshToken;
    return { loggedOut: true, setCookies: ['appenglish_access=; Max-Age=0', 'appenglish_refresh=; Max-Age=0'] };
  };
  let databaseUp = true;
  const dataSource = {
    isInitialized: true,
    async query() { if (!databaseUp) throw new Error('down'); },
  };

  const grpcUrl = `127.0.0.1:${await freePort()}`;
  class TestAuthModule {}
  Module({
    controllers: [AuthGrpcController],
    providers: [
      { provide: AuthController, useValue: new AuthController(service) },
      { provide: AUTH_DATA_SOURCE, useValue: dataSource },
    ],
  })(TestAuthModule);
  class TestGatewayModule {}
  Module({
    imports: [ClientsModule.register([{ name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions(grpcUrl) }])],
    controllers: [HealthController, AuthGatewayController],
  })(TestGatewayModule);
  const auth = await NestFactory.createMicroservice(TestAuthModule, { transport: Transport.GRPC, options: authGrpcOptions(grpcUrl), logger: false });
  const gateway = await NestFactory.create(TestGatewayModule, { logger: false });
  let authClosed = false;
  try {
    await auth.listen();
    await gateway.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${gateway.getHttpServer().address().port}`;
    const adminCookie = { cookie: 'appenglish_access=admin-token; other=1' };

    for (const [query, status, field] of [
      ['?page=1&pageSize=20', 200],
      ['?role=&page=1&pageSize=20', 400, 'role'],
      ['?status=&page=1&pageSize=20', 400, 'status'],
      ['?email=&role=&status=&page=1&pageSize=20', 400, 'status'],
      ['?status=ACTIVE&page=1&pageSize=20', 200],
      ['?status=INVALID&page=1&pageSize=20', 400, 'status'],
    ]) {
      await t.test(`admin list ${query}`, async () => {
        const before = repositoryCalls;
        const response = await fetch(`${base}/auth/admin/accounts${query}`, { headers: adminCookie });
        const body = await response.json();
        assert.equal(response.status, status);
        if (status === 200) {
          assert.equal(body.code, 0);
          assert.equal(body.data.items[0].status, 'ACTIVE');
          assert.equal(repositoryCalls, before + 1);
          assert.equal(seen.accessToken, 'admin-token');
          assert.equal(lastQuery.page, 1);
          assert.equal(lastQuery.status, query.includes('status=ACTIVE') ? 'ACTIVE' : undefined);
        } else {
          assert.equal(body.code, 30);
          assert.equal(body.msg, 'fail');
          assert.ok(body.data.issues.some((issue) => issue.path[0] === field));
          assert.equal(repositoryCalls, before);
        }
      });
    }
    await t.test('missing/null/empty account status never becomes a successful response', async () => {
      for (const status of [undefined, null, '']) {
        fixture.status = status;
        const response = await fetch(`${base}/auth/admin/accounts?page=1&pageSize=20`, { headers: adminCookie });
        const body = await response.json();
        assert.equal(response.status, 400);
        assert.equal(body.code, 30);
        assert.ok(body.data.issues.some((issue) => issue.path[0] === 'status'));
        assert.equal(body.data.items, undefined);
      }
      fixture.status = 'ACTIVE';
    });
    await t.test('non-admin remains forbidden through the gateway', async () => {
      actorRole = 'STUDENT';
      const before = repositoryCalls;
      const response = await fetch(`${base}/auth/admin/accounts?page=1&pageSize=20`, { headers: adminCookie });
      const body = await response.json();
      assert.equal(response.status, 403);
      assert.equal(body.code, 26);
      assert.equal(repositoryCalls, before);
      actorRole = 'ADMIN';
    });
    await t.test('admin detail and update map errors to their HTTP envelopes', async () => {
      const ok = await fetch(`${base}/auth/admin/accounts/${fixture.id}`, { headers: adminCookie });
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).data.account.email, fixture.email);
      const invalidId = await fetch(`${base}/auth/admin/accounts/not-a-uuid`, { headers: adminCookie });
      assert.equal(invalidId.status, 400);
      assert.equal((await invalidId.json()).code, 30);
      const anonymous = await fetch(`${base}/auth/admin/accounts/${fixture.id}`);
      assert.equal(anonymous.status, 401);
      assert.equal((await anonymous.json()).code, 21);
      const emptyUpdate = await fetch(`${base}/auth/admin/accounts/${fixture.id}`, {
        method: 'PATCH', headers: { ...adminCookie, 'content-type': 'application/json' }, body: '{}',
      });
      assert.equal(emptyUpdate.status, 400);
      assert.equal((await emptyUpdate.json()).code, 30);
    });
    await t.test('login relays the body and Set-Cookie headers; logout reads the refresh cookie', async () => {
      const login = await fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'Fixture@Example.com', password: 'correct horse battery staple' }),
      });
      const body = await login.json();
      assert.equal(login.ok, true);
      assert.equal(body.code, 0);
      assert.equal(body.data.account.email, fixture.email);
      assert.equal('setCookies' in body.data, false);
      assert.deepEqual(seen.login, { email: 'fixture@example.com', password: 'correct horse battery staple' });
      assert.deepEqual(login.headers.getSetCookie(), ['appenglish_access=a; HttpOnly', 'appenglish_refresh=r; HttpOnly']);
      const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { cookie: 'appenglish_refresh=refresh%2Ftoken' } });
      assert.equal(logout.ok, true);
      assert.equal(seen.refreshToken, 'refresh/token');
      assert.equal(logout.headers.getSetCookie().length, 2);
    });
    await t.test('invalid bodies keep the 400 validation envelope', async () => {
      for (const [path, payload] of [
        ['/auth/login', {}],
        ['/auth/register', { email: 'new@example.com', password: 'correct horse battery staple', role: 'ADMIN' }],
        ['/auth/resend-verification', {}],
      ]) {
        const response = await fetch(`${base}${path}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        });
        assert.equal(response.status, 400, path);
        assert.equal((await response.json()).code, 30, path);
      }
    });
    await t.test('readiness is relayed over gRPC', async () => {
      const ready = await fetch(`${base}/health/ready`);
      assert.equal(ready.status, 200);
      assert.equal((await ready.json()).database, 'ok');
      databaseUp = false;
      const notReady = await fetch(`${base}/health/ready`);
      assert.equal(notReady.status, 503);
      assert.equal((await notReady.json()).code, 32);
      databaseUp = true;
    });
    await t.test('an unreachable auth-service becomes a 503 gateway envelope', async () => {
      await auth.close();
      authClosed = true;
      const response = await fetch(`${base}/auth/me`, { headers: adminCookie });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { code: 32, msg: 'fail', data: { message: 'Authentication service is unavailable' } });
    });
  } finally {
    await gateway.close();
    if (!authClosed) await auth.close();
  }
});

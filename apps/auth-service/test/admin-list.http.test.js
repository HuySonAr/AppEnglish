import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { AuthGatewayController } from '../../api-gateway/src/auth/auth-gateway.controller.js';

test('Admin list HTTP contract through gateway rejects empty filters without querying accounts', async (t) => {
  let repositoryCalls = 0;
  const fixture = {
    id: '2f4d3b6a-1c2e-4f60-9b1d-8a7c5e2f9d10',
    email: 'fixture@example.com', role: 'STUDENT', status: 'ACTIVE',
    createdAt: new Date('2026-10-09T00:00:00Z'),
  };
  let actorRole = 'ADMIN';
  const service = new AuthService({
    async listAccounts() {
      repositoryCalls++;
      return { items: [fixture], total: 1 };
    },
  }, undefined, undefined, undefined, new AuthorizationService());
  // Session validation is isolated; controller/schema/mapper/authorization and
  // both HTTP servers are real. No database, credentials or tokens are used.
  service.me = async () => ({ account: { id: fixture.id, role: actorRole } });
  class TestAuthModule {}
  Module({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: service }] })(TestAuthModule);
  class TestGatewayModule {}
  Module({ controllers: [AuthGatewayController] })(TestGatewayModule);
  const auth = await NestFactory.create(TestAuthModule, { logger: false });
  const gateway = await NestFactory.create(TestGatewayModule, { logger: false });
  const previousPort = process.env.AUTH_SERVICE_PORT;
  const nativeFetch = globalThis.fetch;
  let forwarded;
  try {
    await auth.listen(0, '127.0.0.1');
    process.env.AUTH_SERVICE_PORT = String(auth.getHttpServer().address().port);
    await gateway.listen(0, '127.0.0.1');
    globalThis.fetch = (url, options) => {
      forwarded = { url, method: options.method };
      return nativeFetch(url, options);
    };
    const base = `http://127.0.0.1:${gateway.getHttpServer().address().port}`;
    for (const [query, status, field] of [
      ['?page=1&pageSize=20', 200],
      ['?role=&page=1&pageSize=20', 400, 'role'],
      ['?status=&page=1&pageSize=20', 400, 'status'],
      ['?email=&role=&status=&page=1&pageSize=20', 400, 'status'],
      ['?status=ACTIVE&page=1&pageSize=20', 200],
      ['?status=INVALID&page=1&pageSize=20', 400, 'status'],
    ]) {
      await t.test(query, async () => {
        const before = repositoryCalls;
        const response = await nativeFetch(`${base}/auth/admin/accounts${query}`);
        const body = await response.json();
        assert.equal(response.status, status);
        assert.equal(forwarded.method, 'GET');
        assert.equal(new URL(forwarded.url).search, query);
        if (status === 200) {
          assert.equal(body.code, 0);
          assert.equal(body.data.items[0].status, 'ACTIVE');
          assert.equal(repositoryCalls, before + 1);
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
        const response = await nativeFetch(`${base}/auth/admin/accounts?page=1&pageSize=20`);
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
      const response = await nativeFetch(`${base}/auth/admin/accounts?page=1&pageSize=20`);
      const body = await response.json();
      assert.equal(response.status, 403);
      assert.equal(body.code, 'FORBIDDEN_ROLE');
      assert.equal(repositoryCalls, before);
    });
  } finally {
    globalThis.fetch = nativeFetch;
    await gateway.close();
    await auth.close();
    if (previousPort === undefined) delete process.env.AUTH_SERVICE_PORT;
    else process.env.AUTH_SERVICE_PORT = previousPort;
  }
});

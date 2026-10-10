import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { Controller, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientsModule, GrpcMethod, Transport } from '@nestjs/microservices';
import { authGrpcOptions, AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { learningGrpcOptions } from '@appenglish/learning-contracts/grpc';
import { AUTH_GRPC_CLIENT } from '../../api-gateway/src/auth/auth-gateway.controller.js';
import { LEARNING_GRPC_CLIENT, LearningGatewayController } from '../../api-gateway/src/learning/learning-gateway.controller.js';
import { PlacementGrpcController } from '../src/placement/placement.grpc.controller.js';
import { PlacementService } from '../src/placement/placement.service.js';
import { admin, answersFor, createContentClient, createMemoryRepository, manager, placementPaper, student } from './helpers.js';

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

// Stand-in for auth-service: the access token is the role name.
const accounts = { manager, student, admin };
class FakeAuthController {
  me({ accessToken }) {
    const account = accounts[accessToken];
    return account
      ? { httpStatus: 200, code: 0, msg: 'success', dataJson: JSON.stringify({ account }), setCookies: [] }
      : { httpStatus: 401, code: 21, msg: 'fail', dataJson: '{}', setCookies: [] };
  }
}
Controller()(FakeAuthController);
GrpcMethod(AUTH_GRPC_SERVICE, 'Me')(FakeAuthController.prototype, 'me', Object.getOwnPropertyDescriptor(FakeAuthController.prototype, 'me'));

test('Gateway HTTP to learning-service gRPC contract for placement', async (t) => {
  const paper = placementPaper();
  const repository = createMemoryRepository();
  const service = new PlacementService(repository, createContentClient(paper));
  const authUrl = `127.0.0.1:${await freePort()}`;
  const learningUrl = `127.0.0.1:${await freePort()}`;

  class TestAuthModule {}
  Module({ controllers: [FakeAuthController] })(TestAuthModule);
  class TestLearningModule {}
  Module({ controllers: [PlacementGrpcController], providers: [{ provide: PlacementService, useValue: service }] })(TestLearningModule);
  class TestGatewayModule {}
  Module({
    imports: [ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions(authUrl) },
      { name: LEARNING_GRPC_CLIENT, transport: Transport.GRPC, options: learningGrpcOptions(learningUrl) },
    ])],
    controllers: [LearningGatewayController],
  })(TestGatewayModule);
  const auth = await NestFactory.createMicroservice(TestAuthModule, { transport: Transport.GRPC, options: authGrpcOptions(authUrl), logger: false });
  const learning = await NestFactory.createMicroservice(TestLearningModule, { transport: Transport.GRPC, options: learningGrpcOptions(learningUrl), logger: false });
  const gateway = await NestFactory.create(TestGatewayModule, { logger: false });
  let learningClosed = false;
  try {
    await auth.listen();
    await learning.listen();
    await gateway.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${gateway.getHttpServer().address().port}`;
    const call = async (method, url, { as, body } = {}) => {
      const response = await fetch(base + url, {
        method,
        headers: {
          ...(as ? { cookie: `appenglish_access=${as}` } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json() };
    };

    await t.test('every placement route requires a session and the right role', async () => {
      for (const [method, url] of [['GET', '/placement'], ['POST', '/placement/start'], ['POST', '/placement/skip'], ['GET', '/placement/settings']]) {
        const response = await call(method, url);
        assert.equal(response.status, 401, url);
        assert.equal(response.json.code, 21, url);
      }
      for (const as of ['manager', 'admin']) assert.equal((await call('POST', '/placement/start', { as })).status, 403);
      for (const as of ['manager', 'student']) {
        const response = await call('GET', '/placement/settings', { as });
        assert.equal(response.status, 403);
        assert.equal(response.json.code, 26);
      }
    });

    await t.test('a student takes the test through the gateway', async () => {
      const before = await call('GET', '/placement', { as: 'student' });
      assert.deepEqual(before.json, { code: 0, msg: 'success', data: { status: 'NOT_STARTED', available: true, durationMinutes: 25 } });
      assert.equal((await call('POST', '/placement/submit', { as: 'student', body: { answers: {} } })).json.code, 52);

      const started = await call('POST', '/placement/start', { as: 'student' });
      assert.equal(started.status, 201);
      assert.equal(started.json.data.parts.length, 7);
      assert.equal(JSON.stringify(started.json).includes('isCorrect'), false);

      for (const body of [{ answers: { 'not-a-uuid': 'x' } }, { answers: {}, extra: true }, { answers: 'x' }]) {
        const invalid = await call('PUT', '/placement/answers', { as: 'student', body });
        assert.equal(invalid.status, 400);
        assert.equal(invalid.json.code, 30);
      }
      const saved = await call('PUT', '/placement/answers', { as: 'student', body: { answers: answersFor(paper, 3) } });
      assert.deepEqual(saved.json.data, { saved: true });
      assert.equal(Object.keys((await call('GET', '/placement', { as: 'student' })).json.data.answers).length, 23);

      const result = await call('POST', '/placement/submit', { as: 'student', body: { answers: answersFor(paper, 19) } });
      assert.equal(result.status, 201);
      assert.deepEqual(result.json.data, { status: 'COMPLETED', startUnit: 3, correctCount: 19, totalCount: 23, scorePercent: 83 });
      const again = await call('POST', '/placement/start', { as: 'student' });
      assert.equal(again.status, 409);
      assert.equal(again.json.code, 51);
      assert.equal(repository.tables.attempts[0].accountId, student.id);
    });

    await t.test('an admin reads and changes the thresholds', async () => {
      assert.deepEqual((await call('GET', '/placement/settings', { as: 'admin' })).json.data.settings, { unit2Threshold: 60, unit3Threshold: 80 });
      for (const body of [{ unit2Threshold: 80, unit3Threshold: 60 }, { unit2Threshold: 0, unit3Threshold: 50 }, { unit2Threshold: 50 }, { unit2Threshold: 50.5, unit3Threshold: 70 }]) {
        const invalid = await call('PUT', '/placement/settings', { as: 'admin', body });
        assert.equal(invalid.status, 400, JSON.stringify(body));
        assert.equal(invalid.json.code, 30);
      }
      const updated = await call('PUT', '/placement/settings', { as: 'admin', body: { unit2Threshold: 50, unit3Threshold: 75 } });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.json.data.settings, { unit2Threshold: 50, unit3Threshold: 75 });
      assert.equal(repository.tables.settings.updatedBy, admin.id);
    });

    await t.test('an unreachable learning-service becomes a 503 gateway envelope', async () => {
      await learning.close();
      learningClosed = true;
      const response = await call('GET', '/placement', { as: 'student' });
      assert.equal(response.status, 503);
      assert.deepEqual(response.json, { code: 32, msg: 'fail', data: { message: 'Learning service is unavailable' } });
    });
  } finally {
    await gateway.close();
    if (!learningClosed) await learning.close();
    await auth.close();
  }
});

import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { Controller, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientsModule, GrpcMethod, Transport } from '@nestjs/microservices';
import { authGrpcOptions, AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { LearningEventType } from '@appenglish/learning-contracts';
import { progressGrpcOptions } from '@appenglish/progress-contracts/grpc';
import { AUTH_GRPC_CLIENT } from '../../api-gateway/src/auth/auth-gateway.controller.js';
import { PROGRESS_GRPC_CLIENT, ProgressGatewayController } from '../../api-gateway/src/progress/progress-gateway.controller.js';
import { ProgressGrpcController } from '../src/progress/progress.grpc.controller.js';
import { ProgressService } from '../src/progress/progress.service.js';
import { lessonTest, manager, message, mockTest, progressHarness, student } from './helpers.js';

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

const accounts = { manager, student: { ...student, email: 'learner@appenglish.test' } };
class FakeAuthController {
  me({ accessToken }) {
    const account = accounts[accessToken];
    return account
      ? { httpStatus: 200, code: 0, msg: 'success', dataJson: JSON.stringify({ account }), setCookies: [] }
      : { httpStatus: 401, code: 21, msg: 'fail', dataJson: '{}', setCookies: [] };
  }
  getProfiles({ accountIds }) {
    const profiles = accountIds.filter((id) => id === student.id).map((id) => ({ id, displayName: 'Learner One', avatarUrl: null }));
    return { httpStatus: 200, code: 0, msg: 'success', dataJson: JSON.stringify({ profiles }), setCookies: [] };
  }
}
Controller()(FakeAuthController);
GrpcMethod(AUTH_GRPC_SERVICE, 'Me')(FakeAuthController.prototype, 'me', Object.getOwnPropertyDescriptor(FakeAuthController.prototype, 'me'));
GrpcMethod(AUTH_GRPC_SERVICE, 'GetProfiles')(FakeAuthController.prototype, 'getProfiles', Object.getOwnPropertyDescriptor(FakeAuthController.prototype, 'getProfiles'));

test('Gateway HTTP to progress-service gRPC contract', async (t) => {
  const { service, content } = progressHarness([2]);
  const [first] = content.lessons;
  await service.applyResult(message(LearningEventType.LESSON_TEST_SUBMITTED, lessonTest(student.id, first.id, { listening: 9, reading: 12 })));
  await service.applyResult(message(LearningEventType.LESSON_COMPLETED, { accountId: student.id, lessonId: first.id, completedAt: '2026-10-17T08:00:00.000Z' }));
  await service.applyResult(message(LearningEventType.MOCK_SUBMITTED, mockTest(student.id, '55555555-5555-4555-8555-555555555555', { listening: 70, listeningTotal: 100, reading: 50, readingTotal: 100, email: 'learner@appenglish.test', title: 'Level 2 test' })));
  const authUrl = `127.0.0.1:${await freePort()}`;
  const progressUrl = `127.0.0.1:${await freePort()}`;

  class TestAuthModule {}
  Module({ controllers: [FakeAuthController] })(TestAuthModule);
  class TestProgressModule {}
  Module({ controllers: [ProgressGrpcController], providers: [{ provide: ProgressService, useValue: service }] })(TestProgressModule);
  class TestGatewayModule {}
  Module({
    imports: [
      ClientsModule.register([
        { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions(authUrl) },
        { name: PROGRESS_GRPC_CLIENT, transport: Transport.GRPC, options: progressGrpcOptions(progressUrl) },
      ]),
    ],
    controllers: [ProgressGatewayController],
  })(TestGatewayModule);
  const auth = await NestFactory.createMicroservice(TestAuthModule, { transport: Transport.GRPC, options: authGrpcOptions(authUrl), logger: false });
  const progress = await NestFactory.createMicroservice(TestProgressModule, { transport: Transport.GRPC, options: progressGrpcOptions(progressUrl), logger: false });
  const gateway = await NestFactory.create(TestGatewayModule, { logger: false });
  try {
    await auth.listen();
    await progress.listen();
    await gateway.listen(0, '127.0.0.1');
    const base = await gateway.getUrl();
    const call = async (token, path = '') => {
      const response = await fetch(`${base}/progress${path}`, { headers: token ? { cookie: `appenglish_access=${token}` } : {} });
      return { status: response.status, body: await response.json() };
    };

    const ok = await call('student');
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.code, 0);
    assert.deepEqual([ok.body.data.completion.completedLessons, ok.body.data.completion.totalLessons, ok.body.data.completion.percent], [1, 2, 50]);
    assert.deepEqual(ok.body.data.skills, {
      listening: { percent: 85, testCount: 2, lessonTests: 1, mockTests: 1 },
      reading: { percent: 68, testCount: 2, lessonTests: 1, mockTests: 1 },
    });

    const xp = await call('student', '/xp');
    assert.equal(xp.status, 200);
    assert.deepEqual([xp.body.data.totalXp, xp.body.data.rank, xp.body.data.entries.map((entry) => [entry.mockTestTitle, entry.xp])], [60, 1, [['Level 2 test', 60]]]);
    const board = await call('student', '/leaderboard');
    assert.deepEqual(board.body.data.entries.map((entry) => [entry.rank, entry.displayName, entry.avatarUrl, entry.email, entry.totalXp, entry.isYou]), [[1, 'Learner One', null, undefined, 60, true]]);
    assert.deepEqual([board.body.data.learnerCount, board.body.data.you.rank, board.body.data.you.displayName], [1, 1, 'Learner One']);
    assert.deepEqual([(await call('manager', '/xp')).status, (await call('manager', '/leaderboard')).status], [403, 403]);

    const forbidden = await call('manager');
    assert.deepEqual([forbidden.status, forbidden.body.code], [403, 26]);
    const anonymous = await call();
    assert.deepEqual([anonymous.status, anonymous.body.code], [401, 21]);
  } finally {
    await gateway.close();
    await progress.close();
    await auth.close();
  }
});

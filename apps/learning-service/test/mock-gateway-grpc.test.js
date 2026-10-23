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
import { LEARNING_GRPC_CLIENT, MockGatewayController } from '../../api-gateway/src/learning/learning-gateway.controller.js';
import { MockGrpcController } from '../src/mock/mock.grpc.controller.js';
import { MockService } from '../src/mock/mock.service.js';
import { admin, manager, student } from './helpers.js';
import { harness } from './mock-helpers.js';

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

const accounts = { manager, admin, student };
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

test('Gateway HTTP to learning-service gRPC contract for mock tests', async () => {
  const { service, tests, answers } = await harness();
  const [first] = tests;
  const authUrl = `127.0.0.1:${await freePort()}`;
  const learningUrl = `127.0.0.1:${await freePort()}`;

  class TestAuthModule {}
  Module({ controllers: [FakeAuthController] })(TestAuthModule);
  class TestLearningModule {}
  Module({ controllers: [MockGrpcController], providers: [{ provide: MockService, useValue: service }] })(TestLearningModule);
  class TestGatewayModule {}
  Module({
    imports: [ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions(authUrl) },
      { name: LEARNING_GRPC_CLIENT, transport: Transport.GRPC, options: learningGrpcOptions(learningUrl) },
    ])],
    controllers: [MockGatewayController],
  })(TestGatewayModule);
  const auth = await NestFactory.createMicroservice(TestAuthModule, { transport: Transport.GRPC, options: authGrpcOptions(authUrl), logger: false });
  const learning = await NestFactory.createMicroservice(TestLearningModule, { transport: Transport.GRPC, options: learningGrpcOptions(learningUrl), logger: false });
  const gateway = await NestFactory.create(TestGatewayModule, { logger: false });
  try {
    await auth.listen();
    await learning.listen();
    await gateway.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${gateway.getHttpServer().address().port}`;
    const call = async (method, url, { as = 'student', body } = {}) => {
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
    const mock = `/mock-tests/${first.id}`;

    assert.equal((await call('GET', '/mock-tests', { as: null })).status, 401);
    assert.equal((await call('GET', '/mock-tests', { as: 'manager' })).status, 403);
    assert.equal((await call('GET', '/mock-tests/not-a-uuid')).status, 400);
    assert.equal((await call('GET', '/mock-tests/00000000-0000-4000-8000-000000000000')).json.code, 57);
    assert.equal((await call('GET', '/mock-tests/score-conversion')).status, 403);
    const conversion = await call('GET', '/mock-tests/score-conversion', { as: 'admin' });
    assert.equal(conversion.json.data.conversion.listening.length, 101);
    assert.equal((await call('PUT', '/mock-tests/score-conversion', { as: 'admin', body: { listening: [5], reading: [5] } })).status, 400);
    assert.equal((await call('PUT', '/mock-tests/score-conversion', { as: 'admin', body: conversion.json.data.conversion })).json.data.isDefault, false);

    assert.equal((await call('GET', '/mock-tests')).json.data.mockTests.length, 2);
    assert.deepEqual((await call('GET', `${mock}/attempt?kind=FULL`)).json.data, { status: 'NONE' });
    for (const url of [`${mock}/attempt`, `${mock}/attempt?kind=MINI`, `${mock}/attempt?kind=FULL&partKey=part5`, `${mock}/attempt?kind=MINI&partKey=part9`])
      assert.equal((await call('GET', url)).status, 400, url);
    const started = await call('POST', `${mock}/attempt/start`, { body: { kind: 'FULL' } });
    assert.equal(started.status, 201);
    assert.equal(started.json.data.parts.length, 7);
    assert.equal((await call('GET', `${mock}/attempt?kind=FULL`)).json.data.status, 'IN_PROGRESS');
    assert.deepEqual((await call('PUT', `${mock}/attempt/answers`, { body: { kind: 'FULL', answers: answers(first.id, 1) } })).json.data, { saved: true });
    const result = await call('POST', `${mock}/attempt/submit`, { body: { kind: 'FULL', answers: answers(first.id, 13) } });
    assert.equal(result.json.data.attempt.scorePercent, 100);
    assert.equal(result.json.data.attempt.estimated.totalScore, 990);
    assert.equal((await call('GET', `${mock}/review?kind=FULL&attemptNumber=1`)).json.data.attempt.attemptNumber, 1);
    assert.deepEqual((await call('GET', `${mock}/review?kind=FULL&attemptNumber=4`)).json.data, { attempt: null, parts: [] });

    assert.equal((await call('GET', '/mock-tests/goal')).json.data.estimate.total, 990);
    assert.deepEqual((await call('PUT', '/mock-tests/goal', { body: { targetScore: 700 } })).json.data.goal, { targetScore: 700, examDate: null });
    assert.equal((await call('GET', '/mock-tests/mistakes')).json.data.total, 0);
    assert.deepEqual((await call('GET', '/mock-tests/mistakes/practice?partKey=part5')).json.data.questions, []);
    assert.equal((await call('POST', '/mock-tests/mistakes/answer', { body: { questionId: '00000000-0000-4000-8000-000000000000', optionId: null } })).json.code, 57);
    assert.equal((await call('DELETE', '/mock-tests/goal')).json.data.goal, null);

    const miniStart = await call('POST', `${mock}/attempt/start`, { body: { kind: 'MINI', partKey: 'part5' } });
    assert.deepEqual(miniStart.json.data.parts.map((part) => part.key), ['part5']);
    assert.equal(miniStart.json.data.expiresAt, null);
    assert.equal((await call('GET', `${mock}/attempt?kind=MINI&partKey=part5`)).json.data.status, 'IN_PROGRESS');
    assert.equal((await call('POST', `${mock}/attempt/discard`, { body: { kind: 'MINI' } })).status, 400);
    assert.deepEqual((await call('POST', `${mock}/attempt/discard`, { body: { kind: 'MINI', partKey: 'part5' } })).json.data, { discarded: true });
    assert.equal((await call('POST', `${mock}/attempt/discard`, { body: { kind: 'MINI', partKey: 'part5' } })).status, 409);
    await call('POST', `${mock}/attempt/start`, { body: { kind: 'MINI', partKey: 'part5' } });
    const miniResult = await call('POST', `${mock}/attempt/submit`, { body: { kind: 'MINI', partKey: 'part5', answers: answers(first.id, 1, ['part5']) } });
    assert.equal(miniResult.json.data.attempt.scorePercent, 50);
    assert.equal(miniResult.json.data.attempt.estimated, null);
    const detail = await call('GET', mock);
    assert.equal(detail.json.data.full.attempts.length, 1);
    assert.equal(detail.json.data.parts.find((part) => part.key === 'part5').mini.attempts.length, 1);
  } finally {
    await gateway.close();
    await learning.close();
    await auth.close();
  }
});

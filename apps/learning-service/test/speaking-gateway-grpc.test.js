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
import { LEARNING_GRPC_CLIENT, LessonGatewayController } from '../../api-gateway/src/learning/learning-gateway.controller.js';
import { SpeakingGrpcController } from '../src/speaking/speaking.grpc.controller.js';
import { SpeakingService } from '../src/speaking/speaking.service.js';
import { manager, student } from './helpers.js';
import { speakingHarness } from './speaking-helpers.js';

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

const accounts = { manager, student };
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

test('Gateway HTTP to learning-service gRPC contract for speaking, including the recording upload', async () => {
  const { service, readAloud, stored } = speakingHarness();
  const authUrl = `127.0.0.1:${await freePort()}`;
  const learningUrl = `127.0.0.1:${await freePort()}`;

  class TestAuthModule {}
  Module({ controllers: [FakeAuthController] })(TestAuthModule);
  class TestLearningModule {}
  Module({ controllers: [SpeakingGrpcController], providers: [{ provide: SpeakingService, useValue: service }] })(TestLearningModule);
  class TestGatewayModule {}
  Module({
    imports: [ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions(authUrl) },
      { name: LEARNING_GRPC_CLIENT, transport: Transport.GRPC, options: learningGrpcOptions(learningUrl) },
    ])],
    controllers: [LessonGatewayController],
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
      const response = await fetch(base + url, { method, headers: as ? { cookie: `appenglish_access=${as}` } : {}, body });
      return { status: response.status, json: await response.json() };
    };
    const recording = (type = 'audio/webm', seconds = '3.5') => {
      const form = new FormData();
      form.set('audio', new Blob([new Uint8Array([1, 2, 3, 4])], { type }), 'take.webm');
      form.set('durationSeconds', seconds);
      return form;
    };

    assert.equal((await call('GET', '/learning/speaking/prompts', { as: null })).status, 401);
    assert.equal((await call('GET', '/learning/speaking/prompts', { as: 'manager' })).status, 403);
    assert.equal((await call('GET', '/learning/speaking/prompts')).json.data.prompts.length, 1);
    assert.equal((await call('GET', '/learning/speaking/prompts/not-a-uuid')).status, 400);
    assert.equal((await call('GET', '/learning/speaking/prompts/00000000-0000-4000-8000-000000000000')).json.code, 65);
    assert.equal((await call('GET', `/learning/speaking/prompts/${readAloud.id}`)).json.data.prompt.text, 'The train leaves at nine.');

    assert.equal((await call('POST', `/learning/speaking/prompts/${readAloud.id}/submissions`, { body: recording('text/plain') })).json.code, 67);
    assert.equal((await call('POST', `/learning/speaking/prompts/${readAloud.id}/submissions`, { body: recording('audio/webm', '60') })).json.code, 67);
    const submitted = await call('POST', `/learning/speaking/prompts/${readAloud.id}/submissions`, { body: recording() });
    assert.equal(submitted.status, 201);
    assert.equal(submitted.json.data.submission.status, 'SCORING');
    assert.equal(submitted.json.data.submission.durationSeconds, 3.5);
    assert.deepEqual(stored, [['audio/webm', 4]]);
    const id = submitted.json.data.submission.id;
    assert.equal((await call('GET', `/learning/speaking/submissions/${id}`)).json.data.submission.id, id);
    assert.equal((await call('GET', '/learning/speaking/submissions/00000000-0000-4000-8000-000000000000')).json.code, 66);
  } finally {
    await gateway.close();
    await learning.close();
    await auth.close();
  }
});

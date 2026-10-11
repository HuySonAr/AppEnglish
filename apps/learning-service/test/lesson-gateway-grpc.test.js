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
import { LessonGrpcController } from '../src/lesson/lesson.grpc.controller.js';
import { LessonService } from '../src/lesson/lesson.service.js';
import { admin, manager, student } from './helpers.js';
import { createCurriculum, createLessonRepository, placementWith, quizAnswers, testAnswers } from './lesson-helpers.js';

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
const accounts = { manager, admin, student: { ...student, email: 'learner@appenglish.test' } };
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

test('Gateway HTTP to learning-service gRPC contract for the lesson flow', async (t) => {
  const content = createCurriculum([2]);
  const repository = createLessonRepository();
  const service = new LessonService(repository, await placementWith(student.id, 1), content);
  const [first, second] = content.lessons;
  const paper = content.paperOf(first.id);
  const authUrl = `127.0.0.1:${await freePort()}`;
  const learningUrl = `127.0.0.1:${await freePort()}`;

  class TestAuthModule {}
  Module({ controllers: [FakeAuthController] })(TestAuthModule);
  class TestLearningModule {}
  Module({ controllers: [LessonGrpcController], providers: [{ provide: LessonService, useValue: service }] })(TestLearningModule);
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
    const lesson = `/learning/lessons/${first.id}`;

    await t.test('sessions, roles and ids are checked', async () => {
      assert.equal((await call('GET', '/learning/curriculum', { as: null })).status, 401);
      for (const as of ['manager', 'admin']) {
        const response = await call('GET', '/learning/curriculum', { as });
        assert.equal(response.status, 403);
        assert.equal(response.json.code, 26);
      }
      const badId = await call('GET', '/learning/lessons/not-a-uuid');
      assert.equal(badId.status, 400);
      assert.equal(badId.json.code, 30);
      assert.equal((await call('GET', '/learning/lessons/00000000-0000-4000-8000-000000000000')).json.code, 53);
      const locked = await call('GET', `/learning/lessons/${second.id}`);
      assert.equal(locked.status, 409);
      assert.deepEqual(locked.json, { code: 54, msg: 'fail', data: { placementRequired: false } });
      assert.equal((await call('GET', `${lesson}/quiz/other`)).status, 400);
    });

    await t.test('a student goes through a lesson over HTTP', async () => {
      const curriculum = await call('GET', '/learning/curriculum');
      assert.deepEqual(curriculum.json.data.units[0].lessons.map((item) => item.state), ['OPEN', 'LOCKED']);
      assert.equal((await call('GET', lesson)).json.data.vocabulary.length, 5);

      const early = await call('POST', `${lesson}/test/start`);
      assert.equal(early.status, 409);
      assert.deepEqual(early.json.data, { step: 'vocabulary' });

      assert.deepEqual((await call('POST', `${lesson}/vocabulary/studied`)).json.data, { studied: true });
      const quiz = await call('GET', `${lesson}/quiz/vocabulary`);
      assert.equal(quiz.json.data.kind, 'vocabulary');
      assert.equal(quiz.json.data.questions.length, 5);
      const wrongQuiz = await call('POST', `${lesson}/quiz/vocabulary`, { body: { answers: quizAnswers(paper, { wrong: 1 }) } });
      assert.equal(wrongQuiz.json.data.passed, false);
      assert.equal(wrongQuiz.json.data.wrongIds.length, 1);
      assert.equal((await call('POST', `${lesson}/quiz/vocabulary`, { body: { answers: quizAnswers(paper) } })).json.data.passed, true);

      assert.equal((await call('POST', `${lesson}/fill-in`, { body: { answers: 'x' } })).status, 400);
      assert.deepEqual((await call('POST', `${lesson}/fill-in`, { body: { answers: paper.content.fillIn.answers } })).json.data, { passed: true, total: 2, wrongBlanks: [] });

      assert.equal((await call('GET', `${lesson}/test`)).json.data.status, 'READY');
      const started = await call('POST', `${lesson}/test/start`);
      assert.equal(started.status, 201);
      assert.equal(started.json.data.status, 'IN_PROGRESS');
      assert.equal(JSON.stringify(started.json).includes('isCorrect'), false);
      assert.deepEqual((await call('PUT', `${lesson}/test/answers`, { body: { answers: testAnswers(paper, 2) } })).json.data, { saved: true });
      assert.equal((await call('PUT', `${lesson}/test/answers`, { body: { answers: { x: 'y' } } })).status, 400);

      const result = await call('POST', `${lesson}/test/submit`, { body: { answers: testAnswers(paper, 21) } });
      assert.equal(result.status, 201);
      assert.equal(result.json.data.attempt.scorePercent, 91);
      assert.equal(result.json.data.attempt.passed, true);
      assert.equal(result.json.data.parts[0].transcript, 'Secret transcript');
      assert.equal((await call('GET', `${lesson}/test/review`)).json.data.attempt.attemptNumber, 1);
      assert.equal((await call('GET', `${lesson}/test/review/1`)).json.data.attempt.scorePercent, 91);
      assert.deepEqual((await call('GET', `${lesson}/test/review/7`)).json.data, { attempt: null, parts: [] });
      assert.equal((await call('GET', `${lesson}/test/review/abc`)).status, 400);
      assert.equal((await call('GET', `${lesson}/test`)).json.data.progression, null);

      // The email passed by the gateway shows in the ranking.
      const ranking = await call('GET', `${lesson}/ranking`);
      assert.deepEqual(ranking.json.data.entries.map((entry) => [entry.rank, entry.email, entry.isMe]), [[1, 'learner@appenglish.test', true]]);
      assert.deepEqual((await call('GET', '/learning/curriculum')).json.data.units[0].lessons.map((item) => [item.state, item.bestPercent]), [['COMPLETED', 91], ['OPEN', null]]);
      // The next lesson now asks for the review of this one.
      const next = await call('GET', `/learning/lessons/${second.id}`);
      assert.deepEqual(next.json.data.review, { lessonId: first.id, lessonTitle: 'U1L1' });
      assert.equal((await call('GET', `/learning/lessons/${second.id}/quiz/review`)).json.data.questions.length, 5);
    });
  } finally {
    await gateway.close();
    await learning.close();
    await auth.close();
  }
});

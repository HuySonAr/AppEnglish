import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { Controller, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientsModule, GrpcMethod, Transport } from '@nestjs/microservices';
import { authGrpcOptions, AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { contentGrpcOptions } from '@appenglish/content-contracts/grpc';
import { ContentGrpcController } from '../src/content/content.grpc.controller.js';
import { ContentService } from '../src/content/content.service.js';
import { LocalMediaStorageAdapter } from '../src/media/local-media-storage.adapter.js';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AUTH_GRPC_CLIENT } from '../../api-gateway/src/auth/auth-gateway.controller.js';
import { CONTENT_GRPC_CLIENT, ContentGatewayController } from '../../api-gateway/src/content/content-gateway.controller.js';
import { admin, createMemoryRepository, manager, publishableContent, student } from './memory-repository.js';

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

test('Gateway HTTP to content-service gRPC contract', async (t) => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), 'appenglish-content-'));
  const repository = createMemoryRepository();
  const service = new ContentService(repository, new LocalMediaStorageAdapter({ rootDirectory: mediaRoot, maxFileSizeBytes: 1024 }));
  const authUrl = `127.0.0.1:${await freePort()}`;
  const contentUrl = `127.0.0.1:${await freePort()}`;

  class TestAuthModule {}
  Module({ controllers: [FakeAuthController] })(TestAuthModule);
  class TestContentModule {}
  Module({ controllers: [ContentGrpcController], providers: [{ provide: ContentService, useValue: service }] })(TestContentModule);
  class TestGatewayModule {}
  Module({
    imports: [ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions(authUrl) },
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions(contentUrl) },
    ])],
    controllers: [ContentGatewayController],
  })(TestGatewayModule);
  const auth = await NestFactory.createMicroservice(TestAuthModule, { transport: Transport.GRPC, options: authGrpcOptions(authUrl), logger: false });
  const content = await NestFactory.createMicroservice(TestContentModule, { transport: Transport.GRPC, options: contentGrpcOptions(contentUrl), logger: false });
  const gateway = await NestFactory.create(TestGatewayModule, { logger: false });
  let contentClosed = false;
  try {
    await auth.listen();
    await content.listen();
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
    const upload = async (as, kind, fileName, type, bytes) => {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', new Blob([bytes], { type }), fileName);
      const response = await fetch(`${base}/content/media`, { method: 'POST', headers: { cookie: `appenglish_access=${as}` }, body: form });
      return { status: response.status, json: await response.json() };
    };

    let unitId;
    let lessonId;
    await t.test('every content route requires a session', async () => {
      for (const [method, url] of [['GET', '/content/units'], ['POST', '/content/units'], ['POST', '/content/media']]) {
        const response = await call(method, url);
        assert.equal(response.status, 401, url);
        assert.equal(response.json.code, 21, url);
      }
    });
    await t.test('only a Content Manager can create content', async () => {
      for (const as of ['student', 'admin']) {
        const response = await call('POST', '/content/units', { as, body: { title: 'Unit 1' } });
        assert.equal(response.status, 403);
        assert.equal(response.json.code, 26);
      }
      const created = await call('POST', '/content/units', { as: 'manager', body: { title: ' Unit 1 ' } });
      assert.equal(created.status, 201);
      assert.equal(created.json.code, 0);
      assert.equal(created.json.data.unit.title, 'Unit 1');
      assert.equal(created.json.data.unit.status, 'DRAFT');
      unitId = created.json.data.unit.id;
      assert.equal(repository.tables.units[0].createdBy, manager.id);
    });
    await t.test('payloads and ids are validated by content-service', async () => {
      for (const [method, url, body] of [
        ['POST', '/content/units', {}],
        ['POST', '/content/units', { title: 'x', extra: true }],
        ['PATCH', `/content/units/${unitId}`, {}],
        ['PATCH', '/content/units/not-a-uuid', { title: 'x' }],
        ['PUT', '/content/lessons/not-a-uuid/draft', {}],
        ['PUT', `/content/lessons/${unitId}/draft`, { vocabulary: [{ word: 'x', unknown: true }] }],
      ]) {
        const response = await call(method, url, { as: 'manager', body });
        assert.equal(response.status, 400, `${method} ${url}`);
        assert.equal(response.json.code, 30);
        assert.ok(response.json.data.issues.length);
      }
      const missing = await call('GET', '/content/lessons/00000000-0000-4000-8000-000000000000', { as: 'manager' });
      assert.equal(missing.status, 404);
      assert.equal(missing.json.code, 40);
    });
    await t.test('media upload goes through multipart, gRPC bytes and storage validation', async () => {
      const forbidden = await upload('student', 'audio', 'q.mp3', 'audio/mpeg', new Uint8Array([1, 2, 3]));
      assert.equal(forbidden.status, 403);
      const wrongType = await upload('manager', 'audio', 'q.wav', 'audio/wav', new Uint8Array([1, 2, 3]));
      assert.equal(wrongType.status, 400);
      assert.equal(wrongType.json.code, 43);
      const tooLarge = await upload('manager', 'audio', 'q.mp3', 'audio/mpeg', new Uint8Array(2048));
      assert.equal(tooLarge.status, 400);
      assert.equal(tooLarge.json.data.reason, 'MEDIA_FILE_TOO_LARGE');
      const ok = await upload('manager', 'audio', 'q.mp3', 'audio/mpeg', new Uint8Array([1, 2, 3]));
      assert.equal(ok.status, 201);
      assert.equal(ok.json.data.media.sizeBytes, 3);
      assert.equal('url' in ok.json.data.media, false);
      const image = await upload('manager', 'image', 'photo.png', 'image/png', new Uint8Array([1, 2, 3, 4]));
      assert.equal(image.status, 201);
      assert.equal(image.json.data.media.kind, 'image');
      assert.equal(repository.tables.media.length, 2);
      const spare = (await upload('manager', 'image', 'spare.png', 'image/png', new Uint8Array([9]))).json.data.media.id;
      const refused = await call('DELETE', `/content/media/${spare}`, { as: 'student' });
      assert.equal(refused.status, 403);
      const gone = await call('DELETE', `/content/media/${spare}`, { as: 'manager' });
      assert.equal(gone.status, 200);
      assert.deepEqual(gone.json.data, { deleted: true });
      assert.equal((await call('DELETE', `/content/media/${spare}`, { as: 'manager' })).status, 404);
      assert.equal((await call('DELETE', '/content/media/not-a-uuid', { as: 'manager' })).status, 400);
      assert.equal(repository.tables.media.length, 2);
    });
    await t.test('draft, publish and learner view', async () => {
      const audioId = repository.tables.media[0].id;
      const imageId = repository.tables.media[1].id;
      for (let index = 1; index <= 5; index++) {
        const created = await call('POST', `/content/units/${unitId}/lessons`, { as: 'manager', body: { title: `Lesson ${index}` } });
        assert.equal(created.status, 201);
        const id = created.json.data.lesson.id;
        lessonId ??= id;
        const empty = await call('POST', `/content/lessons/${id}/publish`, { as: 'manager' });
        assert.equal(empty.status, 409);
        assert.equal(empty.json.code, 42);
        const saved = await call('PUT', `/content/lessons/${id}/draft`, { as: 'manager', body: publishableContent({ audioId, imageId }) });
        assert.equal(saved.status, 200);
        assert.equal(saved.json.data.draft.content.test.part5.questions.length, 6);
        if (index === 5) {
          const early = await call('POST', `/content/units/${unitId}/publish`, { as: 'manager' });
          assert.equal(early.status, 409);
          assert.equal(early.json.code, 42);
        }
        const published = await call('POST', `/content/lessons/${id}/publish`, { as: 'manager' });
        assert.equal(published.status, 201);
        assert.equal(published.json.data.published.versionNumber, 1);
      }
      assert.deepEqual((await call('GET', '/content/units', { as: 'student' })).json.data.units, []);
      const unit = await call('POST', `/content/units/${unitId}/publish`, { as: 'manager' });
      assert.equal(unit.json.data.unit.status, 'PUBLISHED');

      const listed = await call('GET', '/content/units', { as: 'student' });
      assert.equal(listed.status, 200);
      assert.equal(listed.json.data.units[0].lessons.length, 5);
      const lesson = await call('GET', `/content/lessons/${lessonId}`, { as: 'student' });
      assert.equal(lesson.status, 200);
      assert.deepEqual(lesson.json.data.test, { questionCount: 23 });
      assert.equal(lesson.json.data.fillIn.blankCount, 2);
      assert.equal(JSON.stringify(lesson.json).includes('isCorrect'), false);
      const managed = await call('GET', `/content/lessons/${lessonId}`, { as: 'manager' });
      assert.equal(managed.json.data.published.content.test.part3.audioMediaId, audioId);
      assert.equal(managed.json.data.published.content.test.part1.questions[0].imageMediaId, imageId);
      const moved = await call('PATCH', `/content/lessons/${lessonId}`, { as: 'manager', body: { position: 5 } });
      assert.equal(moved.json.data.lesson.position, 5);
    });
    await t.test('an unreachable content-service becomes a 503 gateway envelope', async () => {
      await content.close();
      contentClosed = true;
      const response = await call('GET', '/content/units', { as: 'manager' });
      assert.equal(response.status, 503);
      assert.deepEqual(response.json, { code: 32, msg: 'fail', data: { message: 'Content service is unavailable' } });
    });
  } finally {
    await gateway.close();
    if (!contentClosed) await content.close();
    await auth.close();
    await rm(mediaRoot, { recursive: true, force: true });
  }
});

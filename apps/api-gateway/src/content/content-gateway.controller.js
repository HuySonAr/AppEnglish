import { Body, Controller, Delete, Get, HttpException, Inject, Param, Patch, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { AUTH_GRPC_CLIENT, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { callService } from '../grpc/grpc-call.js';

export const CONTENT_GRPC_CLIENT = 'CONTENT_GRPC_CLIENT';

// Upper bound for one uploaded file held in memory; content-service applies the
// configured MEDIA_MAX_FILE_SIZE_BYTES and the type rules.
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;

export class ContentGatewayController {
  constructor(authClient, contentClient) {
    this.authClient = authClient;
    this.contentClient = contentClient;
  }

  onModuleInit() {
    this.auth = this.authClient.getService(AUTH_GRPC_SERVICE);
    this.content = this.contentClient.getService(CONTENT_GRPC_SERVICE);
  }

  listUnits(request) {
    return this.forward('ListUnits', request);
  }
  createUnit(body, request) {
    return this.forward('CreateUnit', request, { body });
  }
  updateUnit(id, body, request) {
    return this.forward('UpdateUnit', request, { id, body });
  }
  publishUnit(id, request) {
    return this.forward('PublishUnit', request, { id });
  }
  createLesson(unitId, body, request) {
    return this.forward('CreateLesson', request, { id: unitId, body });
  }
  updateLesson(id, body, request) {
    return this.forward('UpdateLesson', request, { id, body });
  }
  getLesson(id, request) {
    return this.forward('GetLesson', request, { id });
  }
  saveLessonDraft(id, body, request) {
    return this.forward('SaveLessonDraft', request, { id, body });
  }
  publishLesson(id, request) {
    return this.forward('PublishLesson', request, { id });
  }
  autofillPronunciation(body, request) {
    return this.forward('AutofillPronunciation', request, { body });
  }
  getPlacement(request) {
    return this.forward('GetPlacement', request);
  }
  savePlacementDraft(body, request) {
    return this.forward('SavePlacementDraft', request, { body });
  }
  publishPlacement(request) {
    return this.forward('PublishPlacement', request);
  }
  listExamTypes(request) {
    return this.forward('ListExamTypes', request);
  }
  createExamType(body, request) {
    return this.forward('CreateExamType', request, { body });
  }
  updateExamType(id, body, request) {
    return this.forward('UpdateExamType', request, { id, body });
  }
  listMockTests(request) {
    return this.forward('ListMockTests', request);
  }
  createMockTest(body, request) {
    return this.forward('CreateMockTest', request, { body });
  }
  updateMockTest(id, body, request) {
    return this.forward('UpdateMockTest', request, { id, body });
  }
  getMockTest(id, request) {
    return this.forward('GetMockTest', request, { id });
  }
  saveMockTestDraft(id, body, request) {
    return this.forward('SaveMockTestDraft', request, { id, body });
  }
  publishMockTest(id, request) {
    return this.forward('PublishMockTest', request, { id });
  }
  listListeningTopics(request) {
    return this.forward('ListListeningTopics', request);
  }
  createListeningTopic(body, request) {
    return this.forward('CreateListeningTopic', request, { body });
  }
  updateListeningTopic(id, body, request) {
    return this.forward('UpdateListeningTopic', request, { id, body });
  }
  listListeningExercises(request) {
    return this.forward('ListListeningExercises', request);
  }
  createListeningExercise(body, request) {
    return this.forward('CreateListeningExercise', request, { body });
  }
  updateListeningExercise(id, body, request) {
    return this.forward('UpdateListeningExercise', request, { id, body });
  }
  getListeningExercise(id, request) {
    return this.forward('GetListeningExercise', request, { id });
  }
  saveListeningExerciseDraft(id, body, request) {
    return this.forward('SaveListeningExerciseDraft', request, { id, body });
  }
  publishListeningExercise(id, request) {
    return this.forward('PublishListeningExercise', request, { id });
  }
  deleteMedia(id, request) {
    return this.forward('DeleteMedia', request, { id });
  }
  async uploadMedia(file, body, request) {
    const actor = await this.actor(request);
    return this.respond(
      await callService(
        this.content,
        'UploadMedia',
        {
          actor,
          kind: typeof body?.kind === 'string' ? body.kind : '',
          fileName: file?.originalname || '',
          mimeType: file?.mimetype || '',
          data: file?.buffer || Buffer.alloc(0),
          lessonId: typeof body?.lessonId === 'string' ? body.lessonId : '',
          section: typeof body?.section === 'string' ? body.section : '',
        },
        'Content',
      ),
    );
  }

  // Every content route needs a valid session: auth-service verifies the
  // access cookie and returns the account that content-service authorizes.
  async actor(request) {
    const { status, payload } = await callAuth(this.auth, 'Me', {
      accessToken: sessionTokens(request).accessToken,
    });
    if (status >= 400) throw new HttpException(payload, status);
    return { id: payload.data.account.id, role: payload.data.account.role };
  }

  async forward(rpc, request, { id = '', body } = {}) {
    const actor = await this.actor(request);
    return this.respond(
      await callService(
        this.content,
        rpc,
        { actor, id, payloadJson: body === undefined ? '' : JSON.stringify(body) },
        'Content',
      ),
    );
  }

  respond({ status, payload }) {
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }
}

Controller('content')(ContentGatewayController);
Inject(AUTH_GRPC_CLIENT)(ContentGatewayController, undefined, 0);
Inject(CONTENT_GRPC_CLIENT)(ContentGatewayController, undefined, 1);
const routes = [
  [Get, 'units', 'listUnits', [Req()]],
  [Post, 'units', 'createUnit', [Body(), Req()]],
  [Patch, 'units/:id', 'updateUnit', [Param('id'), Body(), Req()]],
  [Post, 'units/:id/publish', 'publishUnit', [Param('id'), Req()]],
  [Post, 'units/:id/lessons', 'createLesson', [Param('id'), Body(), Req()]],
  [Patch, 'lessons/:id', 'updateLesson', [Param('id'), Body(), Req()]],
  [Get, 'lessons/:id', 'getLesson', [Param('id'), Req()]],
  [Put, 'lessons/:id/draft', 'saveLessonDraft', [Param('id'), Body(), Req()]],
  [Post, 'lessons/:id/publish', 'publishLesson', [Param('id'), Req()]],
  [Post, 'pronunciation', 'autofillPronunciation', [Body(), Req()]],
  [Get, 'exam-types', 'listExamTypes', [Req()]],
  [Post, 'exam-types', 'createExamType', [Body(), Req()]],
  [Patch, 'exam-types/:id', 'updateExamType', [Param('id'), Body(), Req()]],
  [Get, 'mock-tests', 'listMockTests', [Req()]],
  [Post, 'mock-tests', 'createMockTest', [Body(), Req()]],
  [Patch, 'mock-tests/:id', 'updateMockTest', [Param('id'), Body(), Req()]],
  [Get, 'mock-tests/:id', 'getMockTest', [Param('id'), Req()]],
  [Put, 'mock-tests/:id/draft', 'saveMockTestDraft', [Param('id'), Body(), Req()]],
  [Post, 'mock-tests/:id/publish', 'publishMockTest', [Param('id'), Req()]],
  [Get, 'listening-topics', 'listListeningTopics', [Req()]],
  [Post, 'listening-topics', 'createListeningTopic', [Body(), Req()]],
  [Patch, 'listening-topics/:id', 'updateListeningTopic', [Param('id'), Body(), Req()]],
  [Get, 'listening-exercises', 'listListeningExercises', [Req()]],
  [Post, 'listening-exercises', 'createListeningExercise', [Body(), Req()]],
  [Patch, 'listening-exercises/:id', 'updateListeningExercise', [Param('id'), Body(), Req()]],
  [Get, 'listening-exercises/:id', 'getListeningExercise', [Param('id'), Req()]],
  [Put, 'listening-exercises/:id/draft', 'saveListeningExerciseDraft', [Param('id'), Body(), Req()]],
  [Post, 'listening-exercises/:id/publish', 'publishListeningExercise', [Param('id'), Req()]],
  [Get, 'placement', 'getPlacement', [Req()]],
  [Put, 'placement/draft', 'savePlacementDraft', [Body(), Req()]],
  [Post, 'placement/publish', 'publishPlacement', [Req()]],
  [Delete, 'media/:id', 'deleteMedia', [Param('id'), Req()]],
  [Post, 'media', 'uploadMedia', [UploadedFile(), Body(), Req()]],
];
for (const [verb, path, method, params] of routes) {
  const descriptor = Object.getOwnPropertyDescriptor(ContentGatewayController.prototype, method);
  verb(path)(ContentGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(ContentGatewayController.prototype, method, index));
}
UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))(
  ContentGatewayController.prototype,
  'uploadMedia',
  Object.getOwnPropertyDescriptor(ContentGatewayController.prototype, 'uploadMedia'),
);

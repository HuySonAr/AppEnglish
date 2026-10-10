import { Body, Controller, Delete, Get, HttpException, Inject, Param, Patch, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { AUTH_GRPC_CLIENT, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { callService } from '../grpc/grpc-call.js';

export const CONTENT_GRPC_CLIENT = 'CONTENT_GRPC_CLIENT';

// Upper bound for one uploaded file held in memory; content-service applies the
// configured MEDIA_MAX_FILE_SIZE_BYTES and the type rules.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

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

import { Body, Controller, Delete, Get, HttpException, Inject, Param, Patch, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentResponseCode, ContentUsageKind } from '@appenglish/content-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LEARNING_GRPC_CLIENT } from '../learning/learning-gateway.controller.js';
import { AUTH_GRPC_CLIENT, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { callService } from '../grpc/grpc-call.js';

export const CONTENT_GRPC_CLIENT = 'CONTENT_GRPC_CLIENT';

// Upper bound for one uploaded file held in memory; content-service applies the
// configured MEDIA_MAX_FILE_SIZE_BYTES and the type rules.
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;

// The usage kind that counts learner attempts on one stored version of each
// versioned content (D128).
const VERSION_USAGE_KINDS = Object.freeze({
  lesson: ContentUsageKind.LESSON_VERSION,
  mockTest: ContentUsageKind.MOCK_VERSION,
  unitReview: ContentUsageKind.UNIT_REVIEW_VERSION,
  courseItem: ContentUsageKind.COURSE_VERSION,
  listeningExercise: ContentUsageKind.LISTENING_VERSION,
});

export class ContentGatewayController {
  constructor(authClient, contentClient, learningClient) {
    this.authClient = authClient;
    this.contentClient = contentClient;
    this.learningClient = learningClient;
  }

  onModuleInit() {
    this.auth = this.authClient.getService(AUTH_GRPC_SERVICE);
    this.content = this.contentClient.getService(CONTENT_GRPC_SERVICE);
    this.learning = this.learningClient?.getService(LEARNING_GRPC_SERVICE);
  }

  // Taking content away (D118). Unpublishing only hides it; deleting is
  // refused with 409 CONTENT_IN_USE while any learner has results for it,
  // which learning-service counts.
  unpublishUnit(id, request) {
    return this.forward('UnpublishUnit', request, { id });
  }
  async deleteUnit(id, request) {
    const actor = await this.actor(request);
    const units = await this.call('ListUnits', actor);
    const unit = (units.data.units || []).find((item) => item.id === id);
    if (!unit) throw new HttpException({ code: ContentResponseCode.CONTENT_NOT_FOUND, msg: 'fail', data: {} }, 404);
    await this.assertUnused(actor, ContentUsageKind.LESSON, unit.lessons.map((lesson) => lesson.id));
    // Attempts at the unit's review count too (D121).
    await this.assertUnused(actor, ContentUsageKind.UNIT, [id]);
    return this.respond(await callService(this.content, 'DeleteUnit', { actor, id, payloadJson: '' }, 'Content'));
  }
  // Version history (D122): kind is a ContentVersionKind, id its owner.
  listContentVersions(kind, id, request) {
    return this.forward('ListContentVersions', request, { id, body: { kind } });
  }
  getContentVersion(kind, id, versionId, request) {
    return this.forward('GetContentVersion', request, { id, body: { kind, versionId } });
  }
  restoreContentVersion(kind, id, versionId, request) {
    return this.forward('RestoreContentVersion', request, { id, body: { kind, versionId } });
  }
  discardContentDraft(kind, id, request) {
    return this.forward('DiscardContentDraft', request, { id, body: { kind } });
  }
  // An old version goes only when no learner attempt refers to it (D128).
  async deleteContentVersion(kind, id, versionId, request) {
    const actor = await this.actor(request);
    const usageKind = VERSION_USAGE_KINDS[kind];
    if (usageKind) await this.assertUnused(actor, usageKind, [versionId]);
    return this.respond(await callService(this.content, 'DeleteContentVersion', { actor, id, payloadJson: JSON.stringify({ kind, versionId }) }, 'Content'));
  }
  // Unit review (D121): the Reading test that closes a unit.
  getUnitReview(id, request) {
    return this.forward('GetUnitReview', request, { id });
  }
  saveUnitReviewDraft(id, body, request) {
    return this.forward('SaveUnitReviewDraft', request, { id, body });
  }
  publishUnitReview(id, request) {
    return this.forward('PublishUnitReview', request, { id });
  }
  unpublishUnitReview(id, request) {
    return this.forward('UnpublishUnitReview', request, { id });
  }
  unpublishLesson(id, request) {
    return this.forward('UnpublishLesson', request, { id });
  }
  deleteLesson(id, request) {
    return this.deleteUnused('DeleteLesson', ContentUsageKind.LESSON, id, request);
  }
  unpublishMockTest(id, request) {
    return this.forward('UnpublishMockTest', request, { id });
  }
  deleteMockTest(id, request) {
    return this.deleteUnused('DeleteMockTest', ContentUsageKind.MOCK_TEST, id, request);
  }
  unpublishListeningExercise(id, request) {
    return this.forward('UnpublishListeningExercise', request, { id });
  }
  deleteListeningExercise(id, request) {
    return this.deleteUnused('DeleteListeningExercise', ContentUsageKind.LISTENING_EXERCISE, id, request);
  }
  unpublishCourseItem(id, request) {
    return this.forward('UnpublishCourseItem', request, { id });
  }
  async deleteCourseItem(id, request) {
    const actor = await this.actor(request);
    const item = await this.call('GetCourseItem', actor, id);
    const type = item.data.item?.type;
    // A topic counts the learners who completed it; a level test its attempts (D145).
    const kind = type === 'topic' ? ContentUsageKind.COURSE_TOPIC : ContentUsageKind.COURSE_TEST;
    await this.assertUnused(actor, kind, [id]);
    return this.respond(await callService(this.content, 'DeleteCourseItem', { actor, id, payloadJson: '' }, 'Content'));
  }
  listOrphanMedia(request) {
    return this.forward('ListOrphanMedia', request);
  }
  deleteOrphanMedia(body, request) {
    return this.forward('DeleteOrphanMedia', request, { body });
  }

  async deleteUnused(rpc, kind, id, request) {
    const actor = await this.actor(request);
    await this.assertUnused(actor, kind, [id]);
    return this.respond(await callService(this.content, rpc, { actor, id, payloadJson: '' }, 'Content'));
  }

  // 409 when learners already have results for any of the ids.
  async assertUnused(actor, kind, ids) {
    if (!ids.length) return;
    const usage = await callService(this.learning, 'GetContentUsage', { actor, id: '', payloadJson: JSON.stringify({ kind, ids }) }, 'Learning');
    if (usage.status >= 400) throw new HttpException(usage.payload, usage.status);
    if (usage.payload.data.total > 0)
      throw new HttpException(
        { code: ContentResponseCode.CONTENT_IN_USE, msg: 'fail', data: { reason: 'HAS_RESULTS', results: usage.payload.data.total, kind } },
        409,
      );
  }

  async call(rpc, actor, id = '') {
    const { status, payload } = await callService(this.content, rpc, { actor, id, payloadJson: '' }, 'Content');
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
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
  deleteListeningTopic(id, request) {
    return this.forward('DeleteListeningTopic', request, { id });
  }
  requestMockTranscribe(id, body, request) {
    return this.forward('RequestMockTranscribe', request, { id, body });
  }
  listMockTranscribe(id, request) {
    return this.forward('ListMockTranscribe', request, { id });
  }
  listContentNotifications(request) {
    return this.forward('ListContentNotifications', request);
  }
  markContentNotificationsRead(body, request) {
    return this.forward('MarkContentNotificationsRead', request, { body: body || {} });
  }
  listAdminContentNotifications(request) {
    return this.forward('ListAdminContentNotifications', request);
  }
  markAdminContentNotificationsRead(body, request) {
    return this.forward('MarkAdminContentNotificationsRead', request, { body: body || {} });
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
  requestListeningAutoTime(id, request) {
    return this.forward('RequestListeningAutoTime', request, { id });
  }
  getListeningAutoTime(id, request) {
    return this.forward('GetListeningAutoTime', request, { id });
  }
  requestListeningTranscribe(id, request) {
    return this.forward('RequestListeningTranscribe', request, { id });
  }
  listListeningCourse(request) {
    return this.forward('ListListeningCourse', request);
  }
  createCourseItem(body, request) {
    return this.forward('CreateCourseItem', request, { body });
  }
  updateCourseItem(id, body, request) {
    return this.forward('UpdateCourseItem', request, { id, body });
  }
  getCourseItem(id, request) {
    return this.forward('GetCourseItem', request, { id });
  }
  saveCourseItemDraft(id, body, request) {
    return this.forward('SaveCourseItemDraft', request, { id, body });
  }
  publishCourseItem(id, request) {
    return this.forward('PublishCourseItem', request, { id });
  }
  // D147: speech jobs on a course topic's own recording.
  requestCourseAutoTime(id, request) {
    return this.forward('RequestCourseAutoTime', request, { id });
  }
  getCourseAutoTime(id, request) {
    return this.forward('GetCourseAutoTime', request, { id });
  }
  requestCourseTranscribe(id, request) {
    return this.forward('RequestCourseTranscribe', request, { id });
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
Inject(LEARNING_GRPC_CLIENT)(ContentGatewayController, undefined, 2);
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
  [Post, 'mock-tests/:id/transcribe', 'requestMockTranscribe', [Param('id'), Body(), Req()]],
  [Get, 'mock-tests/:id/transcribe', 'listMockTranscribe', [Param('id'), Req()]],
  [Get, 'notifications', 'listContentNotifications', [Req()]],
  [Post, 'notifications/read', 'markContentNotificationsRead', [Body(), Req()]],
  [Get, 'admin/notifications', 'listAdminContentNotifications', [Req()]],
  [Post, 'admin/notifications/read', 'markAdminContentNotificationsRead', [Body(), Req()]],
  [Get, 'listening-topics', 'listListeningTopics', [Req()]],
  [Post, 'listening-topics', 'createListeningTopic', [Body(), Req()]],
  [Patch, 'listening-topics/:id', 'updateListeningTopic', [Param('id'), Body(), Req()]],
  [Delete, 'listening-topics/:id', 'deleteListeningTopic', [Param('id'), Req()]],
  [Get, 'listening-exercises', 'listListeningExercises', [Req()]],
  [Post, 'listening-exercises', 'createListeningExercise', [Body(), Req()]],
  [Patch, 'listening-exercises/:id', 'updateListeningExercise', [Param('id'), Body(), Req()]],
  [Get, 'listening-exercises/:id', 'getListeningExercise', [Param('id'), Req()]],
  [Put, 'listening-exercises/:id/draft', 'saveListeningExerciseDraft', [Param('id'), Body(), Req()]],
  [Post, 'listening-exercises/:id/publish', 'publishListeningExercise', [Param('id'), Req()]],
  [Post, 'listening-exercises/:id/auto-time', 'requestListeningAutoTime', [Param('id'), Req()]],
  [Get, 'listening-exercises/:id/auto-time', 'getListeningAutoTime', [Param('id'), Req()]],
  [Post, 'listening-exercises/:id/transcribe', 'requestListeningTranscribe', [Param('id'), Req()]],
  [Get, 'listening-course', 'listListeningCourse', [Req()]],
  [Post, 'listening-course/items', 'createCourseItem', [Body(), Req()]],
  [Patch, 'listening-course/items/:id', 'updateCourseItem', [Param('id'), Body(), Req()]],
  [Get, 'listening-course/items/:id', 'getCourseItem', [Param('id'), Req()]],
  [Put, 'listening-course/items/:id/draft', 'saveCourseItemDraft', [Param('id'), Body(), Req()]],
  [Post, 'listening-course/items/:id/publish', 'publishCourseItem', [Param('id'), Req()]],
  [Post, 'listening-course/items/:id/auto-time', 'requestCourseAutoTime', [Param('id'), Req()]],
  [Get, 'listening-course/items/:id/auto-time', 'getCourseAutoTime', [Param('id'), Req()]],
  [Post, 'listening-course/items/:id/transcribe', 'requestCourseTranscribe', [Param('id'), Req()]],
  [Get, 'placement', 'getPlacement', [Req()]],
  [Put, 'placement/draft', 'savePlacementDraft', [Body(), Req()]],
  [Post, 'placement/publish', 'publishPlacement', [Req()]],
  [Post, 'units/:id/unpublish', 'unpublishUnit', [Param('id'), Req()]],
  [Delete, 'units/:id', 'deleteUnit', [Param('id'), Req()]],
  [Get, 'versions/:kind/:id', 'listContentVersions', [Param('kind'), Param('id'), Req()]],
  [Get, 'versions/:kind/:id/:versionId', 'getContentVersion', [Param('kind'), Param('id'), Param('versionId'), Req()]],
  [Post, 'versions/:kind/:id/:versionId/restore', 'restoreContentVersion', [Param('kind'), Param('id'), Param('versionId'), Req()]],
  [Delete, 'versions/:kind/:id/draft', 'discardContentDraft', [Param('kind'), Param('id'), Req()]],
  // After the literal "draft" route: Nest matches in declaration order.
  [Delete, 'versions/:kind/:id/:versionId', 'deleteContentVersion', [Param('kind'), Param('id'), Param('versionId'), Req()]],
  [Get, 'units/:id/review', 'getUnitReview', [Param('id'), Req()]],
  [Put, 'units/:id/review/draft', 'saveUnitReviewDraft', [Param('id'), Body(), Req()]],
  [Post, 'units/:id/review/publish', 'publishUnitReview', [Param('id'), Req()]],
  [Post, 'units/:id/review/unpublish', 'unpublishUnitReview', [Param('id'), Req()]],
  [Post, 'lessons/:id/unpublish', 'unpublishLesson', [Param('id'), Req()]],
  [Delete, 'lessons/:id', 'deleteLesson', [Param('id'), Req()]],
  [Post, 'mock-tests/:id/unpublish', 'unpublishMockTest', [Param('id'), Req()]],
  [Delete, 'mock-tests/:id', 'deleteMockTest', [Param('id'), Req()]],
  [Post, 'listening-exercises/:id/unpublish', 'unpublishListeningExercise', [Param('id'), Req()]],
  [Delete, 'listening-exercises/:id', 'deleteListeningExercise', [Param('id'), Req()]],
  [Post, 'listening-course/items/:id/unpublish', 'unpublishCourseItem', [Param('id'), Req()]],
  [Delete, 'listening-course/items/:id', 'deleteCourseItem', [Param('id'), Req()]],
  [Get, 'media/orphans', 'listOrphanMedia', [Req()]],
  [Delete, 'media/orphans', 'deleteOrphanMedia', [Body(), Req()]],
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

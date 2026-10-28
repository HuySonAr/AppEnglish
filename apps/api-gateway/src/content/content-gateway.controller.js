import { Body, Controller, Delete, Get, HttpException, Inject, Param, Patch, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentResponseCode, ContentUsageKind } from '@appenglish/content-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LEARNING_GRPC_CLIENT } from '../learning/learning-gateway.controller.js';
import { AUTH_GRPC_CLIENT, attachProfiles, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { resolveSession } from '../auth/session-cache.js';
import { callService } from '../grpc/grpc-call.js';

export const CONTENT_GRPC_CLIENT = 'CONTENT_GRPC_CLIENT';

const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;

const VERSION_USAGE_KINDS = Object.freeze({
  lesson: ContentUsageKind.LESSON_VERSION,
  mockTest: ContentUsageKind.MOCK_VERSION,
  unitReview: ContentUsageKind.UNIT_REVIEW_VERSION,
  listeningExercise: ContentUsageKind.LISTENING_VERSION,
  swTest: ContentUsageKind.SW_TEST_VERSION,
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

  unpublishUnit(id, request) {
    return this.forward('UnpublishUnit', request, { id });
  }
  async deleteUnit(id, request) {
    const actor = await this.actor(request);
    const units = await this.call('ListUnits', actor);
    const unit = (units.data.units || []).find((item) => item.id === id);
    if (!unit) throw new HttpException({ code: ContentResponseCode.CONTENT_NOT_FOUND, msg: 'fail', data: {} }, 404);
    await this.assertUnused(actor, ContentUsageKind.LESSON, unit.lessons.map((lesson) => lesson.id));
    await this.assertUnused(actor, ContentUsageKind.UNIT, [id]);
    return this.respond(await callService(this.content, 'DeleteUnit', { actor, id, payloadJson: '' }, 'Content'));
  }
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
  async deleteContentVersion(kind, id, versionId, request) {
    const actor = await this.actor(request);
    const usageKind = VERSION_USAGE_KINDS[kind];
    if (usageKind) await this.assertUnused(actor, usageKind, [versionId]);
    return this.respond(await callService(this.content, 'DeleteContentVersion', { actor, id, payloadJson: JSON.stringify({ kind, versionId }) }, 'Content'));
  }
  listSwTests(request) {
    return this.forward('ListSwTests', request);
  }
  createSwTest(body, request) {
    return this.forward('CreateSwTest', request, { body });
  }
  updateSwTest(id, body, request) {
    return this.forward('UpdateSwTest', request, { id, body });
  }
  getSwTest(id, request) {
    return this.forward('GetSwTest', request, { id });
  }
  saveSwTestDraft(id, body, request) {
    return this.forward('SaveSwTestDraft', request, { id, body });
  }
  publishSwTest(id, request) {
    return this.forward('PublishSwTest', request, { id });
  }
  unpublishSwTest(id, request) {
    return this.forward('UnpublishSwTest', request, { id });
  }
  deleteSwTest(id, request) {
    return this.deleteUnused('DeleteSwTest', ContentUsageKind.SW_TEST, id, request);
  }
  async listContentReviews(request) {
    const payload = await this.forward('ListContentReviews', request);
    const people = [];
    for (const item of payload.data?.items || []) {
      if (item.editedBy) people.push((item.editor = { accountId: item.editedBy }));
      if (item.submittedBy) people.push((item.submitter = { accountId: item.submittedBy }));
    }
    await attachProfiles(this.auth, people);
    return payload;
  }
  submitContentReview(kind, id, request) {
    return this.forward('SubmitContentReview', request, { id, body: { kind } });
  }
  withdrawContentReview(kind, id, request) {
    return this.forward('WithdrawContentReview', request, { id, body: { kind } });
  }
  approveContentReview(kind, id, request) {
    return this.forward('ApproveContentReview', request, { id, body: { kind } });
  }
  returnContentReview(kind, id, body, request) {
    return this.forward('ReturnContentReview', request, { id, body: { kind, note: body?.note } });
  }
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
  listListeningTests(request) {
    return this.forward('ListListeningTests', request);
  }
  createListeningTest(body, request) {
    return this.forward('CreateListeningTest', request, { body });
  }
  updateListeningTest(id, body, request) {
    return this.forward('UpdateListeningTest', request, { id, body });
  }
  deleteListeningTest(id, request) {
    return this.forward('DeleteListeningTest', request, { id });
  }
  requestMockTranscribe(id, body, request) {
    return this.forward('RequestMockTranscribe', request, { id, body });
  }
  listMockTranscribe(id, request) {
    return this.forward('ListMockTranscribe', request, { id });
  }
  listPracticePrompts(request) {
    return this.practice('ListPracticePrompts', request);
  }
  createPracticePrompt(body, request) {
    return this.practice('CreatePracticePrompt', request, { body });
  }
  getPracticePrompt(id, request) {
    return this.practice('GetPracticePrompt', request, { id });
  }
  savePracticePromptDraft(id, body, request) {
    return this.practice('SavePracticePromptDraft', request, { id, body });
  }
  submitPracticePrompt(id, request) {
    return this.practice('SubmitPracticePrompt', request, { id });
  }
  withdrawPracticePrompt(id, request) {
    return this.practice('WithdrawPracticePrompt', request, { id });
  }
  approvePracticePrompt(id, request) {
    return this.practice('ApprovePracticePrompt', request, { id });
  }
  returnPracticePrompt(id, body, request) {
    return this.practice('ReturnPracticePrompt', request, { id, body });
  }
  unpublishPracticePrompt(id, request) {
    return this.practice('UnpublishPracticePrompt', request, { id });
  }
  deletePracticePrompt(id, request) {
    return this.deleteUnused('DeletePracticePrompt', ContentUsageKind.PRACTICE_PROMPT, id, request);
  }
  createPracticeMachineAudio(body, request) {
    return this.forward('CreatePracticeMachineAudio', request, { body });
  }
  async listContentNotifications(request) {
    const payload = await this.forward('ListContentNotifications', request);
    const people = (payload.data?.notifications || []).filter((item) => item.data?.byId).map((item) => (item.data.by = { accountId: item.data.byId }));
    await attachProfiles(this.auth, people);
    return payload;
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
  requestPracticeAutoTime(id, request) {
    return this.forward('RequestPracticeAutoTime', request, { id });
  }
  getPracticeAutoTime(id, request) {
    return this.forward('GetPracticeAutoTime', request, { id });
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

  async actor(request) {
    const { id, role } = await resolveSession(this.auth, request);
    return { id, role };
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

  async practice(rpc, request, options) {
    const payload = await this.forward(rpc, request, options);
    const rows = [...(payload.data?.prompts || []), ...(payload.data?.prompt ? [payload.data.prompt] : [])].filter((row) => row.authorId);
    const authors = rows.map((row) => (row.author = { accountId: row.authorId }));
    await attachProfiles(this.auth, authors);
    return payload;
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
  [Get, 'practice-prompts', 'listPracticePrompts', [Req()]],
  [Post, 'practice-prompts', 'createPracticePrompt', [Body(), Req()]],
  [Post, 'practice-prompts/machine-audio', 'createPracticeMachineAudio', [Body(), Req()]],
  [Get, 'practice-prompts/:id', 'getPracticePrompt', [Param('id'), Req()]],
  [Put, 'practice-prompts/:id/draft', 'savePracticePromptDraft', [Param('id'), Body(), Req()]],
  [Post, 'practice-prompts/:id/submit', 'submitPracticePrompt', [Param('id'), Req()]],
  [Post, 'practice-prompts/:id/withdraw', 'withdrawPracticePrompt', [Param('id'), Req()]],
  [Post, 'practice-prompts/:id/approve', 'approvePracticePrompt', [Param('id'), Req()]],
  [Post, 'practice-prompts/:id/return', 'returnPracticePrompt', [Param('id'), Body(), Req()]],
  [Post, 'practice-prompts/:id/unpublish', 'unpublishPracticePrompt', [Param('id'), Req()]],
  [Delete, 'practice-prompts/:id', 'deletePracticePrompt', [Param('id'), Req()]],
  [Post, 'notifications/read', 'markContentNotificationsRead', [Body(), Req()]],
  [Get, 'admin/notifications', 'listAdminContentNotifications', [Req()]],
  [Post, 'admin/notifications/read', 'markAdminContentNotificationsRead', [Body(), Req()]],
  [Get, 'listening-topics', 'listListeningTopics', [Req()]],
  [Post, 'listening-topics', 'createListeningTopic', [Body(), Req()]],
  [Patch, 'listening-topics/:id', 'updateListeningTopic', [Param('id'), Body(), Req()]],
  [Delete, 'listening-topics/:id', 'deleteListeningTopic', [Param('id'), Req()]],
  [Get, 'listening-tests', 'listListeningTests', [Req()]],
  [Post, 'listening-tests', 'createListeningTest', [Body(), Req()]],
  [Patch, 'listening-tests/:id', 'updateListeningTest', [Param('id'), Body(), Req()]],
  [Delete, 'listening-tests/:id', 'deleteListeningTest', [Param('id'), Req()]],
  [Get, 'listening-exercises', 'listListeningExercises', [Req()]],
  [Post, 'listening-exercises', 'createListeningExercise', [Body(), Req()]],
  [Patch, 'listening-exercises/:id', 'updateListeningExercise', [Param('id'), Body(), Req()]],
  [Get, 'listening-exercises/:id', 'getListeningExercise', [Param('id'), Req()]],
  [Put, 'listening-exercises/:id/draft', 'saveListeningExerciseDraft', [Param('id'), Body(), Req()]],
  [Post, 'listening-exercises/:id/publish', 'publishListeningExercise', [Param('id'), Req()]],
  [Post, 'practice-prompts/:id/auto-time', 'requestPracticeAutoTime', [Param('id'), Req()]],
  [Get, 'practice-prompts/:id/auto-time', 'getPracticeAutoTime', [Param('id'), Req()]],
  [Post, 'listening-exercises/:id/auto-time', 'requestListeningAutoTime', [Param('id'), Req()]],
  [Get, 'listening-exercises/:id/auto-time', 'getListeningAutoTime', [Param('id'), Req()]],
  [Post, 'listening-exercises/:id/transcribe', 'requestListeningTranscribe', [Param('id'), Req()]],
  [Get, 'placement', 'getPlacement', [Req()]],
  [Put, 'placement/draft', 'savePlacementDraft', [Body(), Req()]],
  [Post, 'placement/publish', 'publishPlacement', [Req()]],
  [Post, 'units/:id/unpublish', 'unpublishUnit', [Param('id'), Req()]],
  [Delete, 'units/:id', 'deleteUnit', [Param('id'), Req()]],
  [Get, 'reviews', 'listContentReviews', [Req()]],
  [Get, 'sw-tests', 'listSwTests', [Req()]],
  [Post, 'sw-tests', 'createSwTest', [Body(), Req()]],
  [Patch, 'sw-tests/:id', 'updateSwTest', [Param('id'), Body(), Req()]],
  [Get, 'sw-tests/:id', 'getSwTest', [Param('id'), Req()]],
  [Put, 'sw-tests/:id/draft', 'saveSwTestDraft', [Param('id'), Body(), Req()]],
  [Post, 'sw-tests/:id/publish', 'publishSwTest', [Param('id'), Req()]],
  [Post, 'sw-tests/:id/unpublish', 'unpublishSwTest', [Param('id'), Req()]],
  [Delete, 'sw-tests/:id', 'deleteSwTest', [Param('id'), Req()]],
  [Post, 'reviews/:kind/:id/submit', 'submitContentReview', [Param('kind'), Param('id'), Req()]],
  [Post, 'reviews/:kind/:id/withdraw', 'withdrawContentReview', [Param('kind'), Param('id'), Req()]],
  [Post, 'reviews/:kind/:id/approve', 'approveContentReview', [Param('kind'), Param('id'), Req()]],
  [Post, 'reviews/:kind/:id/return', 'returnContentReview', [Param('kind'), Param('id'), Body(), Req()]],
  [Get, 'versions/:kind/:id', 'listContentVersions', [Param('kind'), Param('id'), Req()]],
  [Get, 'versions/:kind/:id/:versionId', 'getContentVersion', [Param('kind'), Param('id'), Param('versionId'), Req()]],
  [Post, 'versions/:kind/:id/:versionId/restore', 'restoreContentVersion', [Param('kind'), Param('id'), Param('versionId'), Req()]],
  [Delete, 'versions/:kind/:id/draft', 'discardContentDraft', [Param('kind'), Param('id'), Req()]],
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

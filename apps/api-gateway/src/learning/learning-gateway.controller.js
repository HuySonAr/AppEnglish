import { Body, Controller, Delete, Get, HttpException, Inject, Param, Post, Put, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RECORDING_LIMITS } from '@appenglish/learning-contracts';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { AUTH_GRPC_CLIENT, attachProfiles, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { resolveSession } from '../auth/session-cache.js';
import { callService } from '../grpc/grpc-call.js';

export const LEARNING_GRPC_CLIENT = 'LEARNING_GRPC_CLIENT';

class LearningRelay {
  constructor(authClient, learningClient) {
    this.authClient = authClient;
    this.learningClient = learningClient;
  }

  onModuleInit() {
    this.auth = this.authClient.getService(AUTH_GRPC_SERVICE);
    this.learning = this.learningClient.getService(LEARNING_GRPC_SERVICE);
  }

  async forward(rpc, request, { id = '', body } = {}) {
    const { id: accountId, role, email } = await resolveSession(this.auth, request);
    const { status, payload } = await callService(
      this.learning,
      rpc,
      {
        actor: { id: accountId, role, email: email || '' },
        id,
        payloadJson: body === undefined ? '' : JSON.stringify(body),
      },
      'Learning',
    );
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }
}

export class LearningGatewayController extends LearningRelay {

  getPlacement(request) {
    return this.forward('GetPlacement', request);
  }
  startPlacement(request) {
    return this.forward('StartPlacement', request);
  }
  savePlacementAnswers(body, request) {
    return this.forward('SavePlacementAnswers', request, { body });
  }
  submitPlacement(body, request) {
    return this.forward('SubmitPlacement', request, { body });
  }
  skipPlacement(request) {
    return this.forward('SkipPlacement', request);
  }
  getPlacementSettings(request) {
    return this.forward('GetPlacementSettings', request);
  }
  updatePlacementSettings(body, request) {
    return this.forward('UpdatePlacementSettings', request, { body });
  }
  async adminResetPlacement(accountId, body, request) {
    const result = await this.forward('AdminResetPlacement', request, { id: accountId });
    const reason = body && typeof body.reason === 'string' ? body.reason : '';
    const audit = await callAuth(this.auth, 'AdminAccountAction', {
      accessToken: sessionTokens(request).accessToken,
      accountId,
      action: 'RESET_PLACEMENT',
      reason,
    });
    if (audit.status >= 400) throw new HttpException(audit.payload, audit.status);
    return { ...result, data: { ...result.data, account: audit.payload.data.account } };
  }
}

Controller('placement')(LearningGatewayController);
Inject(AUTH_GRPC_CLIENT)(LearningGatewayController, undefined, 0);
Inject(LEARNING_GRPC_CLIENT)(LearningGatewayController, undefined, 1);
const routes = [
  [Get, '', 'getPlacement', [Req()]],
  [Post, 'start', 'startPlacement', [Req()]],
  [Put, 'answers', 'savePlacementAnswers', [Body(), Req()]],
  [Post, 'submit', 'submitPlacement', [Body(), Req()]],
  [Post, 'skip', 'skipPlacement', [Req()]],
  [Get, 'settings', 'getPlacementSettings', [Req()]],
  [Put, 'settings', 'updatePlacementSettings', [Body(), Req()]],
  [Post, 'admin/learners/:id/reset', 'adminResetPlacement', [Param('id'), Body(), Req()]],
];
for (const [verb, path, method, params] of routes) {
  const descriptor = Object.getOwnPropertyDescriptor(LearningGatewayController.prototype, method);
  verb(path)(LearningGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(LearningGatewayController.prototype, method, index));
}

export class LessonGatewayController extends LearningRelay {
  getCurriculum(request) {
    return this.forward('GetCurriculum', request);
  }
  getLesson(id, request) {
    return this.forward('GetLesson', request, { id });
  }
  markVocabularyStudied(id, request) {
    return this.forward('MarkVocabularyStudied', request, { id });
  }
  getVocabularyQuiz(id, kind, request) {
    return this.forward('GetVocabularyQuiz', request, { id, body: { kind } });
  }
  submitVocabularyQuiz(id, kind, body, request) {
    return this.forward('SubmitVocabularyQuiz', request, { id, body: { ...body, kind } });
  }
  submitFillIn(id, body, request) {
    return this.forward('SubmitFillIn', request, { id, body });
  }
  getLessonTest(id, request) {
    return this.forward('GetLessonTest', request, { id });
  }
  startLessonTest(id, request) {
    return this.forward('StartLessonTest', request, { id });
  }
  saveLessonTestAnswers(id, body, request) {
    return this.forward('SaveLessonTestAnswers', request, { id, body });
  }
  submitLessonTest(id, body, request) {
    return this.forward('SubmitLessonTest', request, { id, body });
  }
  discardLessonTest(id, request) {
    return this.forward('DiscardLessonTest', request, { id });
  }
  getLessonTestReview(id, request) {
    return this.forward('GetLessonTestReview', request, { id });
  }
  getLessonTestAttemptReview(id, attemptNumber, request) {
    return this.forward('GetLessonTestReview', request, { id, body: { attemptNumber: Number(attemptNumber) } });
  }
  getVocabularyPractice(request) {
    return this.forward('GetVocabularyPractice', request);
  }
  completeVocabularyPractice(request) {
    return this.forward('CompleteVocabularyPractice', request);
  }
  listListeningPractice(request) {
    return this.forward('ListListeningPractice', request);
  }
  getListeningPractice(id, query, request) {
    return this.forward('GetListeningPractice', request, { id, body: query?.mode ? { mode: query.mode } : {} });
  }
  getListeningTranscript(id, request) {
    return this.forward('GetListeningTranscript', request, { id });
  }
  checkListeningLine(id, body, request) {
    return this.forward('CheckListeningLine', request, { id, body });
  }
  checkListeningPractice(id, body, request) {
    return this.forward('CheckListeningPractice', request, { id, body });
  }
  getUnitReview(id, request) {
    return this.forward('GetUnitReview', request, { id });
  }
  submitUnitReview(id, body, request) {
    return this.forward('SubmitUnitReview', request, { id, body });
  }
  async getLessonRanking(id, request) {
    const payload = await this.forward('GetLessonRanking', request, { id });
    await attachProfiles(this.auth, [...(payload.data.entries || []), payload.data.me]);
    return payload;
  }
  listSpeakingPrompts(request) {
    return this.forward('ListSpeakingPrompts', request);
  }
  getSpeakingPrompt(id, request) {
    return this.forward('GetSpeakingPrompt', request, { id });
  }
  getSpeakingSubmission(id, request) {
    return this.forward('GetSpeakingSubmission', request, { id });
  }
  listWritingPrompts(request) {
    return this.forward('ListWritingPrompts', request);
  }
  getWritingPrompt(id, request) {
    return this.forward('GetWritingPrompt', request, { id });
  }
  submitWriting(id, body, request) {
    return this.forward('SubmitWriting', request, { id, body });
  }
  getWritingSubmission(id, request) {
    return this.forward('GetWritingSubmission', request, { id });
  }
  getAiKey(request) {
    return this.forward('GetAiKey', request);
  }
  saveAiKey(body, request) {
    return this.forward('SaveAiKey', request, { body });
  }
  listAiModels(query, request) {
    return this.forward('ListAiModels', request, { body: { fresh: query?.fresh === 'true' } });
  }
  saveAiSettings(body, request) {
    return this.forward('SaveAiSettings', request, { body });
  }
  deleteAiKey(request) {
    return this.forward('DeleteAiKey', request);
  }
  getCefrProfile(request) {
    return this.forward('GetCefrProfile', request);
  }
  getReviewQuota(request) {
    return this.forward('GetReviewQuota', request);
  }
  requestReview(body, request) {
    return this.forward('RequestReview', request, { body });
  }
  withdrawReview(body, request) {
    return this.forward('WithdrawReview', request, { body });
  }
  listReviewQueue(request) {
    return this.forward('ListReviewQueue', request);
  }
  claimReview(id, request) {
    return this.forward('ClaimReview', request, { id });
  }
  getReview(id, request) {
    return this.forward('GetReview', request, { id });
  }
  releaseReview(id, request) {
    return this.forward('ReleaseReview', request, { id });
  }
  completeReview(id, body, request) {
    return this.forward('CompleteReview', request, { id, body });
  }
  listSwTests(request) {
    return this.forward('ListSwTests', request);
  }
  getSwTest(id, request) {
    return this.forward('GetSwTest', request, { id });
  }
  startSwAttempt(id, body, request) {
    return this.forward('StartSwAttempt', request, { id, body });
  }
  skipSwQuestion(id, body, request) {
    return this.forward('SkipSwQuestion', request, { id, body });
  }
  saveSwAnswers(id, body, request) {
    return this.forward('SaveSwAnswers', request, { id, body });
  }
  submitSwAttempt(id, body, request) {
    return this.forward('SubmitSwAttempt', request, { id, body });
  }
  discardSwAttempt(id, body, request) {
    return this.forward('DiscardSwAttempt', request, { id, body });
  }
  getSwResult(id, query, request) {
    return this.forward('GetSwResult', request, { id, body: { section: query?.section, ...(query?.attemptNumber ? { attemptNumber: Number(query.attemptNumber) } : {}) } });
  }
  requestSwReview(body, request) {
    return this.forward('RequestSwReview', request, { body });
  }
  retrySwScoring(id, body, request) {
    return this.forward('RetrySwScoring', request, { id, body });
  }
  getSwScoreConversion(request) {
    return this.forward('GetSwScoreConversion', request);
  }
  updateSwScoreConversion(body, request) {
    return this.forward('UpdateSwScoreConversion', request, { body });
  }
  async saveSwRecording(id, file, body, request) {
    const { id: accountId, role, email } = await resolveSession(this.auth, request);
    const durationSeconds = Number(body?.durationSeconds);
    const { status, payload } = await callService(
      this.learning,
      'SaveSwRecording',
      {
        actor: { id: accountId, role, email: email || '' },
        id,
        mimeType: file?.mimetype || '',
        data: file?.buffer || Buffer.alloc(0),
        payloadJson: JSON.stringify({ section: 'speaking', questionNumber: Number(body?.questionNumber), durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0 }),
      },
      'Learning',
    );
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }
  async submitSpeaking(id, file, body, request) {
    const { id: accountId, role, email } = await resolveSession(this.auth, request);
    const durationSeconds = Number(body?.durationSeconds);
    const questionIndex = body?.questionIndex === undefined || body?.questionIndex === '' ? undefined : Number(body.questionIndex);
    const setId = body?.setId || undefined;
    const { status, payload } = await callService(
      this.learning,
      'SubmitSpeaking',
      {
        actor: { id: accountId, role, email: email || '' },
        id,
        mimeType: file?.mimetype || '',
        data: file?.buffer || Buffer.alloc(0),
        payloadJson: JSON.stringify({ durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0, questionIndex, setId }),
      },
      'Learning',
    );
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }
}

Controller('learning')(LessonGatewayController);
Inject(AUTH_GRPC_CLIENT)(LessonGatewayController, undefined, 0);
Inject(LEARNING_GRPC_CLIENT)(LessonGatewayController, undefined, 1);
const lessonRoutes = [
  [Get, 'curriculum', 'getCurriculum', [Req()]],
  [Get, 'lessons/:id', 'getLesson', [Param('id'), Req()]],
  [Post, 'lessons/:id/vocabulary/studied', 'markVocabularyStudied', [Param('id'), Req()]],
  [Get, 'lessons/:id/quiz/:kind', 'getVocabularyQuiz', [Param('id'), Param('kind'), Req()]],
  [Post, 'lessons/:id/quiz/:kind', 'submitVocabularyQuiz', [Param('id'), Param('kind'), Body(), Req()]],
  [Post, 'lessons/:id/fill-in', 'submitFillIn', [Param('id'), Body(), Req()]],
  [Get, 'lessons/:id/test', 'getLessonTest', [Param('id'), Req()]],
  [Post, 'lessons/:id/test/start', 'startLessonTest', [Param('id'), Req()]],
  [Put, 'lessons/:id/test/answers', 'saveLessonTestAnswers', [Param('id'), Body(), Req()]],
  [Post, 'lessons/:id/test/submit', 'submitLessonTest', [Param('id'), Body(), Req()]],
  [Post, 'lessons/:id/test/discard', 'discardLessonTest', [Param('id'), Req()]],
  [Get, 'lessons/:id/test/review', 'getLessonTestReview', [Param('id'), Req()]],
  [Get, 'lessons/:id/test/review/:attemptNumber', 'getLessonTestAttemptReview', [Param('id'), Param('attemptNumber'), Req()]],
  [Get, 'lessons/:id/ranking', 'getLessonRanking', [Param('id'), Req()]],
  [Get, 'units/:id/review', 'getUnitReview', [Param('id'), Req()]],
  [Post, 'units/:id/review/submit', 'submitUnitReview', [Param('id'), Body(), Req()]],
  [Get, 'practice/vocabulary', 'getVocabularyPractice', [Req()]],
  [Post, 'practice/vocabulary/complete', 'completeVocabularyPractice', [Req()]],
  [Get, 'practice/listening', 'listListeningPractice', [Req()]],
  [Get, 'practice/listening/:id', 'getListeningPractice', [Param('id'), Query(), Req()]],
  [Get, 'practice/listening/:id/transcript', 'getListeningTranscript', [Param('id'), Req()]],
  [Post, 'practice/listening/:id/check', 'checkListeningPractice', [Param('id'), Body(), Req()]],
  [Post, 'practice/listening/:id/check-line', 'checkListeningLine', [Param('id'), Body(), Req()]],
  [Get, 'speaking/prompts', 'listSpeakingPrompts', [Req()]],
  [Get, 'speaking/prompts/:id', 'getSpeakingPrompt', [Param('id'), Req()]],
  [Post, 'speaking/prompts/:id/submissions', 'submitSpeaking', [Param('id'), UploadedFile(), Body(), Req()]],
  [Get, 'sw-tests', 'listSwTests', [Req()]],
  [Get, 'sw-tests/score-conversion', 'getSwScoreConversion', [Req()]],
  [Put, 'sw-tests/score-conversion', 'updateSwScoreConversion', [Body(), Req()]],
  [Post, 'sw-tests/:id/result/retry', 'retrySwScoring', [Param('id'), Body(), Req()]],
  [Get, 'sw-tests/:id', 'getSwTest', [Param('id'), Req()]],
  [Post, 'sw-tests/:id/attempt/start', 'startSwAttempt', [Param('id'), Body(), Req()]],
  [Post, 'sw-tests/:id/attempt/recordings', 'saveSwRecording', [Param('id'), UploadedFile(), Body(), Req()]],
  [Post, 'sw-tests/:id/attempt/skip', 'skipSwQuestion', [Param('id'), Body(), Req()]],
  [Put, 'sw-tests/:id/attempt/answers', 'saveSwAnswers', [Param('id'), Body(), Req()]],
  [Post, 'sw-tests/:id/attempt/submit', 'submitSwAttempt', [Param('id'), Body(), Req()]],
  [Post, 'sw-tests/:id/attempt/discard', 'discardSwAttempt', [Param('id'), Body(), Req()]],
  [Get, 'sw-tests/:id/result', 'getSwResult', [Param('id'), Query(), Req()]],
  [Get, 'speaking/submissions/:id', 'getSpeakingSubmission', [Param('id'), Req()]],
  [Get, 'writing/prompts', 'listWritingPrompts', [Req()]],
  [Get, 'writing/prompts/:id', 'getWritingPrompt', [Param('id'), Req()]],
  [Post, 'writing/prompts/:id/submissions', 'submitWriting', [Param('id'), Body(), Req()]],
  [Get, 'writing/submissions/:id', 'getWritingSubmission', [Param('id'), Req()]],
  [Get, 'ai-key', 'getAiKey', [Req()]],
  [Put, 'ai-key', 'saveAiKey', [Body(), Req()]],
  [Delete, 'ai-key', 'deleteAiKey', [Req()]],
  [Put, 'ai-key/settings', 'saveAiSettings', [Body(), Req()]],
  [Get, 'ai-key/models', 'listAiModels', [Query(), Req()]],
  [Get, 'cefr-profile', 'getCefrProfile', [Req()]],
  [Get, 'reviews/quota', 'getReviewQuota', [Req()]],
  [Get, 'reviews/queue', 'listReviewQueue', [Req()]],
  [Post, 'reviews', 'requestReview', [Body(), Req()]],
  [Post, 'reviews/withdraw', 'withdrawReview', [Body(), Req()]],
  [Post, 'reviews/sw-test', 'requestSwReview', [Body(), Req()]],
  [Get, 'reviews/:id', 'getReview', [Param('id'), Req()]],
  [Post, 'reviews/:id/claim', 'claimReview', [Param('id'), Req()]],
  [Post, 'reviews/:id/release', 'releaseReview', [Param('id'), Req()]],
  [Post, 'reviews/:id/complete', 'completeReview', [Param('id'), Body(), Req()]],
];
for (const [verb, path, method, params] of lessonRoutes) {
  const descriptor = Object.getOwnPropertyDescriptor(LessonGatewayController.prototype, method);
  verb(path)(LessonGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(LessonGatewayController.prototype, method, index));
}
UseInterceptors(FileInterceptor('audio', { limits: { fileSize: RECORDING_LIMITS.maxBytes } }))(
  LessonGatewayController.prototype,
  'saveSwRecording',
  Object.getOwnPropertyDescriptor(LessonGatewayController.prototype, 'saveSwRecording'),
);
UseInterceptors(FileInterceptor('audio', { limits: { fileSize: RECORDING_LIMITS.maxBytes } }))(
  LessonGatewayController.prototype,
  'submitSpeaking',
  Object.getOwnPropertyDescriptor(LessonGatewayController.prototype, 'submitSpeaking'),
);

export class MockGatewayController extends LearningRelay {
  reference(query) {
    return {
      kind: query?.kind,
      ...(query?.partKey ? { partKey: query.partKey } : {}),
      ...(query?.attemptNumber ? { attemptNumber: Number(query.attemptNumber) } : {}),
    };
  }

  getScoreConversion(request) {
    return this.forward('GetScoreConversion', request);
  }
  updateScoreConversion(body, request) {
    return this.forward('UpdateScoreConversion', request, { body });
  }
  getStudyGoal(request) {
    return this.forward('GetStudyGoal', request);
  }
  saveStudyGoal(body, request) {
    return this.forward('SaveStudyGoal', request, { body });
  }
  deleteStudyGoal(request) {
    return this.forward('DeleteStudyGoal', request);
  }
  getMockMistakes(request) {
    return this.forward('GetMockMistakes', request);
  }
  getMistakePractice(query, request) {
    return this.forward('GetMistakePractice', request, { body: query?.partKey ? { partKey: query.partKey } : {} });
  }
  answerMistake(body, request) {
    return this.forward('AnswerMistake', request, { body });
  }
  listMockTests(request) {
    return this.forward('ListMockTests', request);
  }
  getMockTest(id, request) {
    return this.forward('GetMockTest', request, { id });
  }
  getMockAttempt(id, query, request) {
    return this.forward('GetMockAttempt', request, { id, body: this.reference(query) });
  }
  startMockAttempt(id, body, request) {
    return this.forward('StartMockAttempt', request, { id, body });
  }
  saveMockAnswers(id, body, request) {
    return this.forward('SaveMockAnswers', request, { id, body });
  }
  finishMockListening(id, body, request) {
    return this.forward('FinishMockListening', request, { id, body });
  }
  submitMockAttempt(id, body, request) {
    return this.forward('SubmitMockAttempt', request, { id, body });
  }
  discardMockAttempt(id, body, request) {
    return this.forward('DiscardMockAttempt', request, { id, body });
  }
  getMockReview(id, query, request) {
    return this.forward('GetMockReview', request, { id, body: this.reference(query) });
  }
  getMockStats(id, request) {
    return this.forward('GetMockStats', request, { id });
  }
}

Controller('mock-tests')(MockGatewayController);
Inject(AUTH_GRPC_CLIENT)(MockGatewayController, undefined, 0);
Inject(LEARNING_GRPC_CLIENT)(MockGatewayController, undefined, 1);
const mockRoutes = [
  [Get, 'score-conversion', 'getScoreConversion', [Req()]],
  [Put, 'score-conversion', 'updateScoreConversion', [Body(), Req()]],
  [Get, 'goal', 'getStudyGoal', [Req()]],
  [Put, 'goal', 'saveStudyGoal', [Body(), Req()]],
  [Delete, 'goal', 'deleteStudyGoal', [Req()]],
  [Get, 'mistakes', 'getMockMistakes', [Req()]],
  [Get, 'mistakes/practice', 'getMistakePractice', [Query(), Req()]],
  [Post, 'mistakes/answer', 'answerMistake', [Body(), Req()]],
  [Get, '', 'listMockTests', [Req()]],
  [Get, ':id', 'getMockTest', [Param('id'), Req()]],
  [Get, ':id/attempt', 'getMockAttempt', [Param('id'), Query(), Req()]],
  [Post, ':id/attempt/start', 'startMockAttempt', [Param('id'), Body(), Req()]],
  [Put, ':id/attempt/answers', 'saveMockAnswers', [Param('id'), Body(), Req()]],
  [Post, ':id/attempt/listening/finish', 'finishMockListening', [Param('id'), Body(), Req()]],
  [Post, ':id/attempt/submit', 'submitMockAttempt', [Param('id'), Body(), Req()]],
  [Post, ':id/attempt/discard', 'discardMockAttempt', [Param('id'), Body(), Req()]],
  [Get, ':id/review', 'getMockReview', [Param('id'), Query(), Req()]],
  [Get, ':id/stats', 'getMockStats', [Param('id'), Req()]],
];
for (const [verb, path, method, params] of mockRoutes) {
  const descriptor = Object.getOwnPropertyDescriptor(MockGatewayController.prototype, method);
  verb(path)(MockGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(MockGatewayController.prototype, method, index));
}


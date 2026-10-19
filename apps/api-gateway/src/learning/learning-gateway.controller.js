import { Body, Controller, Get, HttpException, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { AUTH_GRPC_CLIENT, attachProfiles, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { callService } from '../grpc/grpc-call.js';

export const LEARNING_GRPC_CLIENT = 'LEARNING_GRPC_CLIENT';

// Shared by the two controllers below: authenticates the session and relays
// one call to learning-service over gRPC.
class LearningRelay {
  constructor(authClient, learningClient) {
    this.authClient = authClient;
    this.learningClient = learningClient;
  }

  onModuleInit() {
    this.auth = this.authClient.getService(AUTH_GRPC_SERVICE);
    this.learning = this.learningClient.getService(LEARNING_GRPC_SERVICE);
  }

  // Every route needs a valid session: auth-service verifies the access
  // cookie and returns the account that learning-service authorizes.
  async forward(rpc, request, { id = '', body } = {}) {
    const session = await callAuth(this.auth, 'Me', {
      accessToken: sessionTokens(request).accessToken,
    });
    if (session.status >= 400) throw new HttpException(session.payload, session.status);
    const { id: accountId, role, email } = session.payload.data.account;
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

// Public /placement/* routes (F03).
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
];
for (const [verb, path, method, params] of routes) {
  const descriptor = Object.getOwnPropertyDescriptor(LearningGatewayController.prototype, method);
  verb(path)(LearningGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(LearningGatewayController.prototype, method, index));
}

// Public /learning/* routes (F04): the lesson flow of a student.
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
  listListeningPractice(request) {
    return this.forward('ListListeningPractice', request);
  }
  getListeningPractice(id, query, request) {
    return this.forward('GetListeningPractice', request, { id, body: query?.mode ? { mode: query.mode } : {} });
  }
  checkListeningLine(id, body, request) {
    return this.forward('CheckListeningLine', request, { id, body });
  }
  checkListeningPractice(id, body, request) {
    return this.forward('CheckListeningPractice', request, { id, body });
  }
  getListeningCourse(request) {
    return this.forward('GetListeningCourse', request);
  }
  getCourseLesson(unitId, lessonId, request) {
    return this.forward('GetCourseLesson', request, { id: unitId, body: { lessonId } });
  }
  checkCourseLessonStep(unitId, lessonId, body, request) {
    return this.forward('CheckCourseLessonStep', request, { id: unitId, body: { ...body, lessonId } });
  }
  completeCourseLesson(unitId, lessonId, body, request) {
    return this.forward('CompleteCourseLesson', request, { id: unitId, body: { ...body, lessonId } });
  }
  getCourseProgress(request) {
    return this.forward('GetCourseProgress', request);
  }
  listCourseMistakes(request) {
    return this.forward('ListCourseMistakes', request);
  }
  checkCourseMistake(id, body, request) {
    return this.forward('CheckCourseMistake', request, { id, body });
  }
  getCoursePlacement(request) {
    return this.forward('GetCoursePlacement', request);
  }
  submitCoursePlacement(body, request) {
    return this.forward('SubmitCoursePlacement', request, { body });
  }
  skipCoursePlacement(request) {
    return this.forward('SkipCoursePlacement', request);
  }
  getCourseTest(itemId, request) {
    return this.forward('GetCourseTest', request, { id: itemId });
  }
  submitCourseTest(itemId, body, request) {
    return this.forward('SubmitCourseTest', request, { id: itemId, body });
  }
  // Ranked learners are shown by display name and avatar (D113).
  async getLessonRanking(id, request) {
    const payload = await this.forward('GetLessonRanking', request, { id });
    await attachProfiles(this.auth, [...(payload.data.entries || []), payload.data.me]);
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
  [Get, 'practice/vocabulary', 'getVocabularyPractice', [Req()]],
  [Get, 'practice/listening', 'listListeningPractice', [Req()]],
  [Get, 'practice/listening/:id', 'getListeningPractice', [Param('id'), Query(), Req()]],
  [Post, 'practice/listening/:id/check', 'checkListeningPractice', [Param('id'), Body(), Req()]],
  [Post, 'practice/listening/:id/check-line', 'checkListeningLine', [Param('id'), Body(), Req()]],
  [Get, 'listening-course', 'getListeningCourse', [Req()]],
  [Get, 'listening-course/units/:unitId/lessons/:lessonId', 'getCourseLesson', [Param('unitId'), Param('lessonId'), Req()]],
  [Post, 'listening-course/units/:unitId/lessons/:lessonId/check', 'checkCourseLessonStep', [Param('unitId'), Param('lessonId'), Body(), Req()]],
  [Post, 'listening-course/units/:unitId/lessons/:lessonId/complete', 'completeCourseLesson', [Param('unitId'), Param('lessonId'), Body(), Req()]],
  [Get, 'listening-course/progress', 'getCourseProgress', [Req()]],
  [Get, 'listening-course/mistakes', 'listCourseMistakes', [Req()]],
  [Post, 'listening-course/mistakes/:id/check', 'checkCourseMistake', [Param('id'), Body(), Req()]],
  [Get, 'listening-course/placement', 'getCoursePlacement', [Req()]],
  [Post, 'listening-course/placement/submit', 'submitCoursePlacement', [Body(), Req()]],
  [Post, 'listening-course/placement/skip', 'skipCoursePlacement', [Req()]],
  [Get, 'listening-course/tests/:itemId', 'getCourseTest', [Param('itemId'), Req()]],
  [Post, 'listening-course/tests/:itemId/submit', 'submitCourseTest', [Param('itemId'), Body(), Req()]],
];
for (const [verb, path, method, params] of lessonRoutes) {
  const descriptor = Object.getOwnPropertyDescriptor(LessonGatewayController.prototype, method);
  verb(path)(LessonGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(LessonGatewayController.prototype, method, index));
}

// Public /mock-tests/* routes (F05A): full mock tests and mini tests of a
// student, and the Admin's score conversion table.
export class MockGatewayController extends LearningRelay {
  // Which attempt a GET is about, from ?kind=FULL or ?kind=MINI&partKey=part5.
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
  submitMockAttempt(id, body, request) {
    return this.forward('SubmitMockAttempt', request, { id, body });
  }
  discardMockAttempt(id, body, request) {
    return this.forward('DiscardMockAttempt', request, { id, body });
  }
  getMockReview(id, query, request) {
    return this.forward('GetMockReview', request, { id, body: this.reference(query) });
  }
}

Controller('mock-tests')(MockGatewayController);
Inject(AUTH_GRPC_CLIENT)(MockGatewayController, undefined, 0);
Inject(LEARNING_GRPC_CLIENT)(MockGatewayController, undefined, 1);
// The fixed paths come before ':id' so they are not read as a mock test id.
const mockRoutes = [
  [Get, 'score-conversion', 'getScoreConversion', [Req()]],
  [Put, 'score-conversion', 'updateScoreConversion', [Body(), Req()]],
  [Get, '', 'listMockTests', [Req()]],
  [Get, ':id', 'getMockTest', [Param('id'), Req()]],
  [Get, ':id/attempt', 'getMockAttempt', [Param('id'), Query(), Req()]],
  [Post, ':id/attempt/start', 'startMockAttempt', [Param('id'), Body(), Req()]],
  [Put, ':id/attempt/answers', 'saveMockAnswers', [Param('id'), Body(), Req()]],
  [Post, ':id/attempt/submit', 'submitMockAttempt', [Param('id'), Body(), Req()]],
  [Post, ':id/attempt/discard', 'discardMockAttempt', [Param('id'), Body(), Req()]],
  [Get, ':id/review', 'getMockReview', [Param('id'), Query(), Req()]],
];
for (const [verb, path, method, params] of mockRoutes) {
  const descriptor = Object.getOwnPropertyDescriptor(MockGatewayController.prototype, method);
  verb(path)(MockGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(MockGatewayController.prototype, method, index));
}


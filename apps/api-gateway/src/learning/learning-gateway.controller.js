import { Body, Controller, Get, HttpException, Inject, Param, Post, Put, Req } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { AUTH_GRPC_CLIENT, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
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
  getLessonTestReview(id, request) {
    return this.forward('GetLessonTestReview', request, { id });
  }
  getLessonTestAttemptReview(id, attemptNumber, request) {
    return this.forward('GetLessonTestReview', request, { id, body: { attemptNumber: Number(attemptNumber) } });
  }
  getLessonRanking(id, request) {
    return this.forward('GetLessonRanking', request, { id });
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
  [Get, 'lessons/:id/test/review', 'getLessonTestReview', [Param('id'), Req()]],
  [Get, 'lessons/:id/test/review/:attemptNumber', 'getLessonTestAttemptReview', [Param('id'), Param('attemptNumber'), Req()]],
  [Get, 'lessons/:id/ranking', 'getLessonRanking', [Param('id'), Req()]],
];
for (const [verb, path, method, params] of lessonRoutes) {
  const descriptor = Object.getOwnPropertyDescriptor(LessonGatewayController.prototype, method);
  verb(path)(LessonGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(LessonGatewayController.prototype, method, index));
}

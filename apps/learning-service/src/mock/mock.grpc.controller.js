import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { MockService } from './mock.service.js';
import {
  attemptAnswersSchema,
  attemptReferenceSchema,
  attemptReviewSchema,
  mockIdSchema,
  scoreConversionSchema,
  studyGoalSchema,
  mistakePracticeSchema,
  mistakeAnswerSchema,
} from './mock.schemas.js';

const rpcs = {
  ListMockTests: { run: (service, { actor }) => service.listMockTests(actor) },
  GetMockTest: { id: true, run: (service, { actor, id }) => service.getMockTest(actor, id) },
  GetMockAttempt: {
    id: true,
    payload: attemptReferenceSchema,
    run: (service, { actor, id, payload }) => service.getMockAttempt(actor, id, payload),
  },
  StartMockAttempt: {
    id: true,
    payload: attemptReferenceSchema,
    run: (service, { actor, id, payload }) => service.startMockAttempt(actor, id, payload),
  },
  SaveMockAnswers: {
    id: true,
    payload: attemptAnswersSchema,
    run: (service, { actor, id, payload }) => service.saveMockAnswers(actor, id, payload),
  },
  FinishMockListening: {
    id: true,
    payload: attemptReferenceSchema,
    run: (service, { actor, id, payload }) => service.finishMockListening(actor, id, payload),
  },
  SubmitMockAttempt: {
    id: true,
    payload: attemptAnswersSchema,
    run: (service, { actor, id, payload }) => service.submitMockAttempt(actor, id, payload),
  },
  DiscardMockAttempt: {
    id: true,
    payload: attemptReferenceSchema,
    run: (service, { actor, id, payload }) => service.discardMockAttempt(actor, id, payload),
  },
  GetMockReview: {
    id: true,
    payload: attemptReviewSchema,
    run: (service, { actor, id, payload }) => service.getMockReview(actor, id, payload),
  },
  GetMockStats: { id: true, run: (service, { actor, id }) => service.getMockStats(actor, id) },
  GetStudyGoal: { run: (service, { actor }) => service.getStudyGoal(actor) },
  SaveStudyGoal: { payload: studyGoalSchema, run: (service, { actor, payload }) => service.saveStudyGoal(actor, payload) },
  DeleteStudyGoal: { run: (service, { actor }) => service.deleteStudyGoal(actor) },
  GetMockMistakes: { run: (service, { actor }) => service.getMockMistakes(actor) },
  GetMistakePractice: { payload: mistakePracticeSchema, run: (service, { actor, payload }) => service.getMistakePractice(actor, payload) },
  AnswerMistake: { payload: mistakeAnswerSchema, run: (service, { actor, payload }) => service.answerMistake(actor, payload) },
  GetScoreConversion: { run: (service, { actor }) => service.getScoreConversion(actor) },
  UpdateScoreConversion: {
    payload: scoreConversionSchema,
    run: (service, { actor, payload }) => service.updateScoreConversion(actor, payload),
  },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new LearningError(LearningResponseCode.VALIDATION_ERROR, 'Payload is not valid JSON', 400, {
      issues: [{ path: [], message: 'Payload is not valid JSON' }],
    });
  }
}

export class MockGrpcController {
  constructor(mockService) {
    this.mockService = mockService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.mockService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? mockIdSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
      });
      return this.toReply(200, LearningResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof LearningError)
        return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError')
        return this.toReply(400, LearningResponseCode.VALIDATION_ERROR, 'fail', {
          issues: error.issues,
        });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(MockGrpcController);
Inject(MockService)(MockGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  MockGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(MockGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(
    MockGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(MockGrpcController.prototype, method),
  );
}

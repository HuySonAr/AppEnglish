import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema, answersSchema } from '../placement/placement.schemas.js';
import { LessonService } from './lesson.service.js';
import {
  fillInAnswersSchema,
  lessonIdSchema,
  quizAnswersSchema,
  quizRequestSchema,
  reviewRequestSchema,
} from './lesson.schemas.js';

const rpcs = {
  GetCurriculum: { run: (service, { actor }) => service.getCurriculum(actor) },
  GetLesson: { id: true, run: (service, { actor, id }) => service.getLesson(actor, id) },
  MarkVocabularyStudied: {
    id: true,
    run: (service, { actor, id }) => service.markVocabularyStudied(actor, id),
  },
  GetVocabularyQuiz: {
    id: true,
    payload: quizRequestSchema,
    run: (service, { actor, id, payload }) => service.getVocabularyQuiz(actor, id, payload),
  },
  SubmitVocabularyQuiz: {
    id: true,
    payload: quizAnswersSchema,
    run: (service, { actor, id, payload }) => service.submitVocabularyQuiz(actor, id, payload),
  },
  SubmitFillIn: {
    id: true,
    payload: fillInAnswersSchema,
    run: (service, { actor, id, payload }) => service.submitFillIn(actor, id, payload),
  },
  GetLessonTest: { id: true, run: (service, { actor, id }) => service.getLessonTest(actor, id) },
  StartLessonTest: { id: true, run: (service, { actor, id }) => service.startLessonTest(actor, id) },
  SaveLessonTestAnswers: {
    id: true,
    payload: answersSchema,
    run: (service, { actor, id, payload }) => service.saveLessonTestAnswers(actor, id, payload),
  },
  SubmitLessonTest: {
    id: true,
    payload: answersSchema,
    run: (service, { actor, id, payload }) => service.submitLessonTest(actor, id, payload),
  },
  DiscardLessonTest: { id: true, run: (service, { actor, id }) => service.discardLessonTest(actor, id) },
  GetLessonTestReview: {
    id: true,
    payload: reviewRequestSchema,
    run: (service, { actor, id, payload }) => service.getLessonTestReview(actor, id, payload),
  },
  GetVocabularyPractice: { run: (service, { actor }) => service.getVocabularyPractice(actor) },
  CompleteVocabularyPractice: { run: (service, { actor }) => service.completeVocabularyPractice(actor) },
  GetLessonRanking: {
    id: true,
    run: (service, { actor, id }) => service.getLessonRanking(actor, id),
  },
  GetUnitReview: { id: true, run: (service, { actor, id }) => service.getUnitReview(actor, id) },
  SubmitUnitReview: {
    id: true,
    payload: answersSchema,
    run: (service, { actor, id, payload }) => service.submitUnitReview(actor, id, payload),
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

export class LessonGrpcController {
  constructor(lessonService) {
    this.lessonService = lessonService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.lessonService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? lessonIdSchema.parse(request.id) : undefined,
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

Controller()(LessonGrpcController);
Inject(LessonService)(LessonGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  LessonGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(LessonGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(
    LessonGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(LessonGrpcController.prototype, method),
  );
}

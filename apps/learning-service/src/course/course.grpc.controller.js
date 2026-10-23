import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { CourseLessonService } from './course.service.js';
import { itemIdSchema, sentenceCheckSchema, testAnswersSchema } from './course.schemas.js';

const rpcs = {
  GetListeningCourse: { run: (service, { actor }) => service.getCourse(actor) },
  GetCourseTopic: { id: true, run: (service, { actor, id }) => service.getTopic(actor, id) },
  CheckCourseSentence: { id: true, payload: sentenceCheckSchema, run: (service, { actor, id, payload }) => service.checkSentence(actor, id, payload) },
  CompleteCourseTopic: { id: true, run: (service, { actor, id }) => service.completeTopic(actor, id) },
  GetCourseTest: { id: true, run: (service, { actor, id }) => service.getTest(actor, id) },
  SubmitCourseTest: { id: true, payload: testAnswersSchema, run: (service, { actor, id, payload }) => service.submitTest(actor, id, payload) },
  GetCourseProgress: { run: (service, { actor }) => service.getProgress(actor) },
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

export class CourseGrpcController {
  constructor(courseService) {
    this.courseService = courseService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.courseService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? itemIdSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
      });
      return this.toReply(200, LearningResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof LearningError) return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError') return this.toReply(400, LearningResponseCode.VALIDATION_ERROR, 'fail', { issues: error.issues });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(CourseGrpcController);
Inject(CourseLessonService)(CourseGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  CourseGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(CourseGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(CourseGrpcController.prototype, method, Object.getOwnPropertyDescriptor(CourseGrpcController.prototype, method));
}

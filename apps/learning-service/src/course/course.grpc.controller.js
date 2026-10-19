import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { CourseLessonService } from './course.service.js';
import { lessonAnswersSchema, lessonOpenSchema, mistakeCheckSchema, stepCheckSchema, testAnswersSchema, unitIdSchema } from './course.schemas.js';

// Each RPC: whether it targets an id (a unit, or a level test), the schema of its JSON payload (if
// any) and the service call.
const rpcs = {
  GetListeningCourse: { run: (service, { actor }) => service.getCourse(actor) },
  GetCourseLesson: { id: true, payload: lessonOpenSchema, run: (service, { actor, id, payload }) => service.getLesson(actor, id, payload) },
  CheckCourseLessonStep: { id: true, payload: stepCheckSchema, run: (service, { actor, id, payload }) => service.checkStep(actor, id, payload) },
  CompleteCourseLesson: { id: true, payload: lessonAnswersSchema, run: (service, { actor, id, payload }) => service.complete(actor, id, payload) },
  GetCourseTest: { id: true, run: (service, { actor, id }) => service.getTest(actor, id) },
  SubmitCourseTest: { id: true, payload: testAnswersSchema, run: (service, { actor, id, payload }) => service.submitTest(actor, id, payload) },
  GetCoursePlacement: { run: (service, { actor }) => service.getPlacement(actor) },
  SubmitCoursePlacement: { payload: testAnswersSchema, run: (service, { actor, payload }) => service.submitPlacement(actor, payload) },
  SkipCoursePlacement: { run: (service, { actor }) => service.skipPlacement(actor) },
  GetCourseProgress: { run: (service, { actor }) => service.getProgress(actor) },
  ListCourseMistakes: { run: (service, { actor }) => service.listMistakes(actor) },
  CheckCourseMistake: { id: true, payload: mistakeCheckSchema, run: (service, { actor, id, payload }) => service.checkMistake(actor, id, payload) },
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

  // Shapes the { code, msg, data } envelope. Unexpected errors propagate as a
  // gRPC error and the gateway answers 500.
  async handle(spec, request) {
    try {
      const data = await spec.run(this.courseService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? unitIdSchema.parse(request.id) : undefined,
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
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(CourseGrpcController.prototype, method, Object.getOwnPropertyDescriptor(CourseGrpcController.prototype, method));
}

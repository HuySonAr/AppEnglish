import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from '../content/content.errors.js';
import { actorSchema, idSchema, placementPaperSchema } from '../content/content.schemas.js';
import { CourseService } from './course.service.js';
import { courseItemCreateSchema, courseItemUpdateSchema } from './course.schemas.js';

// Each RPC: whether it targets an item id, the schema of its JSON payload (if
// any) and the service call. Draft contents are validated by the service with
// the schema of the item's type.
const rpcs = {
  ListListeningCourse: { run: (service, { actor }) => service.listCourse(actor) },
  CreateCourseItem: { payload: courseItemCreateSchema, run: (service, { actor, payload }) => service.createItem(actor, payload) },
  UpdateCourseItem: { id: true, payload: courseItemUpdateSchema, run: (service, { actor, id, payload }) => service.updateItem(actor, id, payload) },
  GetCourseItem: { id: true, run: (service, { actor, id }) => service.getItem(actor, id) },
  SaveCourseItemDraft: { id: true, raw: true, run: (service, { actor, id, payload }) => service.saveDraft(actor, id, payload) },
  PublishCourseItem: { id: true, run: (service, { actor, id }) => service.publish(actor, id) },
  UnpublishCourseItem: { id: true, run: (service, { actor, id }) => service.unpublish(actor, id) },
  DeleteCourseItem: { id: true, run: (service, { actor, id }) => service.delete(actor, id) },
  RequestCourseAutoTime: { id: true, run: (service, { actor, id }) => service.requestAutoTime(actor, id) },
  RequestCourseTranscribe: { id: true, run: (service, { actor, id }) => service.requestTranscribe(actor, id) },
  GetCourseAutoTime: { id: true, run: (service, { actor, id }) => service.getAutoTime(actor, id) },
  // Called by learning-service, not by the gateway: there is no actor.
  ListPublishedCourse: { internal: true, run: (service) => service.listPublished() },
  GetCoursePaper: { internal: true, id: true, payload: placementPaperSchema, run: (service, { id, payload }) => service.getPaper(id, payload) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new ContentError(ContentResponseCode.VALIDATION_ERROR, 'Payload is not valid JSON', 400, {
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
      const body = parseJson(request.payloadJson);
      const data = await spec.run(this.courseService, {
        actor: spec.internal ? undefined : actorSchema.parse(request.actor),
        id: spec.id ? idSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(body) : spec.raw ? body : undefined,
      });
      return this.toReply(200, ContentResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof ContentError) return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError') return this.toReply(400, ContentResponseCode.VALIDATION_ERROR, 'fail', { issues: error.issues });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(CourseGrpcController);
Inject(CourseService)(CourseGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  CourseGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(CourseGrpcController.prototype, method, Object.getOwnPropertyDescriptor(CourseGrpcController.prototype, method));
}

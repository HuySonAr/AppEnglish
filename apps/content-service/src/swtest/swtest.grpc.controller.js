import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from '../content/content.errors.js';
import { actorSchema, idSchema } from '../content/content.schemas.js';
import { SwTestService } from './swtest.service.js';
import { swTestContentSchema, swTestCreateSchema, swTestPaperSchema, swTestUpdateSchema } from './swtest.schemas.js';

const rpcs = {
  ListSwTests: { run: (service, { actor }) => service.listTests(actor) },
  CreateSwTest: { payload: swTestCreateSchema, run: (service, { actor, payload }) => service.createTest(actor, payload) },
  UpdateSwTest: { id: true, payload: swTestUpdateSchema, run: (service, { actor, id, payload }) => service.updateTest(actor, id, payload) },
  GetSwTest: { id: true, run: (service, { actor, id }) => service.getTest(actor, id) },
  SaveSwTestDraft: { id: true, payload: swTestContentSchema, run: (service, { actor, id, payload }) => service.saveDraft(actor, id, payload) },
  PublishSwTest: { id: true, run: (service, { actor, id }) => service.publish(actor, id) },
  UnpublishSwTest: { id: true, run: (service, { actor, id }) => service.unpublish(actor, id) },
  DeleteSwTest: { id: true, run: (service, { actor, id }) => service.delete(actor, id) },
  ListPublishedSwTests: { internal: true, run: (service) => service.listPublished() },
  GetSwTestPaper: { internal: true, id: true, payload: swTestPaperSchema, run: (service, { id, payload }) => service.paper(id, payload) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

export class SwTestGrpcController {
  constructor(swTestService) {
    this.swTestService = swTestService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.swTestService, {
        actor: spec.internal ? undefined : actorSchema.parse(request.actor),
        id: spec.id ? idSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
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

Controller()(SwTestGrpcController);
Inject(SwTestService)(SwTestGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  SwTestGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(SwTestGrpcController.prototype, method, rpc);
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(SwTestGrpcController.prototype, method, Object.getOwnPropertyDescriptor(SwTestGrpcController.prototype, method));
}

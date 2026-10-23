import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { promptIdSchema } from '../speaking/speaking.schemas.js';
import { WritingService } from './writing.service.js';
import { saveAiKeySchema, submitWritingSchema } from './writing.schemas.js';

const rpcs = {
  ListWritingPrompts: { run: (service, { actor }) => service.listPrompts(actor) },
  GetWritingPrompt: { id: true, run: (service, { actor, id }) => service.getPrompt(actor, id) },
  SubmitWriting: { id: true, payload: submitWritingSchema, run: (service, { actor, id, payload }) => service.submit(actor, id, payload) },
  GetWritingSubmission: { id: true, run: (service, { actor, id }) => service.getSubmission(actor, id) },
  GetAiKey: { run: (service, { actor }) => service.getKey(actor) },
  SaveAiKey: { payload: saveAiKeySchema, run: (service, { actor, payload }) => service.saveKey(actor, payload) },
  DeleteAiKey: { run: (service, { actor }) => service.deleteKey(actor) },
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

const safeIssues = (issues) => issues.map(({ path, message, code }) => ({ path, message, code }));

export class WritingGrpcController {
  constructor(writingService) {
    this.writingService = writingService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.writingService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? promptIdSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
      });
      return this.toReply(200, LearningResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof LearningError) return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError') return this.toReply(400, LearningResponseCode.VALIDATION_ERROR, 'fail', { issues: safeIssues(error.issues) });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(WritingGrpcController);
Inject(WritingService)(WritingGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  WritingGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(WritingGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(WritingGrpcController.prototype, method, Object.getOwnPropertyDescriptor(WritingGrpcController.prototype, method));
}

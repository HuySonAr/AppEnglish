import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { SpeakingService } from './speaking.service.js';
import { promptIdSchema, submitSpeakingSchema } from './speaking.schemas.js';

const rpcs = {
  ListSpeakingPrompts: { run: (service, { actor }) => service.listPrompts(actor) },
  GetSpeakingPrompt: { id: true, run: (service, { actor, id }) => service.getPrompt(actor, id) },
  GetSpeakingSubmission: { id: true, run: (service, { actor, id }) => service.getSubmission(actor, id) },
  SubmitSpeaking: {
    id: true,
    payload: submitSpeakingSchema,
    upload: true,
    run: (service, { actor, id, payload, upload }) => service.submit(actor, id, { ...upload, ...payload }),
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

export class SpeakingGrpcController {
  constructor(speakingService) {
    this.speakingService = speakingService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.speakingService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? promptIdSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
        upload: spec.upload ? { mimeType: request.mimeType || '', data: request.data || new Uint8Array() } : undefined,
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

Controller()(SpeakingGrpcController);
Inject(SpeakingService)(SpeakingGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  SpeakingGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(SpeakingGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(SpeakingGrpcController.prototype, method, Object.getOwnPropertyDescriptor(SpeakingGrpcController.prototype, method));
}

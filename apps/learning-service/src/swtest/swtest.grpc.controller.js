import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { actorSchema } from '../placement/placement.schemas.js';
import { LearningError } from '../placement/placement.errors.js';
import { SwTestService } from './swtest.service.js';
import { swAnswersSchema, swConversionSchema, swRecordingSchema, swResultSchema, swSectionSchema, swTestIdSchema } from './swtest.schemas.js';
import { z } from 'zod';

const skipSchema = z.object({ section: z.literal('speaking'), questionNumber: z.number().int().min(1).max(11) }).strict();

const rpcs = {
  ListSwTests: { run: (service, { actor }) => service.listTests(actor) },
  GetSwTest: { id: true, run: (service, { actor, id }) => service.getTest(actor, id) },
  StartSwAttempt: { id: true, payload: swSectionSchema, run: (service, { actor, id, payload }) => service.start(actor, id, payload) },
  SaveSwRecording: { id: true, payload: swRecordingSchema, upload: true, run: (service, { actor, id, payload, upload }) => service.saveRecording(actor, id, { ...payload, ...upload }) },
  SkipSwQuestion: { id: true, payload: skipSchema, run: (service, { actor, id, payload }) => service.skipTo(actor, id, payload) },
  SaveSwAnswers: { id: true, payload: swAnswersSchema, run: (service, { actor, id, payload }) => service.saveAnswers(actor, id, payload) },
  SubmitSwAttempt: { id: true, payload: swSectionSchema, run: (service, { actor, id, payload }) => service.submit(actor, id, payload) },
  DiscardSwAttempt: { id: true, payload: swSectionSchema, run: (service, { actor, id, payload }) => service.discard(actor, id, payload) },
  RetrySwScoring: { id: true, payload: swResultSchema, run: (service, { actor, id, payload }) => service.retryScoring(actor, id, payload) },
  GetSwScoreConversion: { run: (service, { actor }) => service.getConversion(actor) },
  UpdateSwScoreConversion: { payload: swConversionSchema, run: (service, { actor, payload }) => service.updateConversion(actor, payload) },
  GetSwResult: { id: true, payload: swResultSchema, run: (service, { actor, id, payload }) => service.getResult(actor, id, payload) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new LearningError(LearningResponseCode.VALIDATION_ERROR, 'Payload is not valid JSON', 400, { issues: [{ path: [], message: 'Payload is not valid JSON' }] });
  }
}

export class SwTestGrpcController {
  constructor(swTestService) {
    this.swTestService = swTestService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.swTestService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? swTestIdSchema.parse(request.id) : undefined,
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

Controller()(SwTestGrpcController);
Inject(SwTestService)(SwTestGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  SwTestGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(SwTestGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(SwTestGrpcController.prototype, method, Object.getOwnPropertyDescriptor(SwTestGrpcController.prototype, method));
}

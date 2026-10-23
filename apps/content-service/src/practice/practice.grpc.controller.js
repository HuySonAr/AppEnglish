import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from '../content/content.errors.js';
import { actorSchema, idSchema } from '../content/content.schemas.js';
import { PracticeService } from './practice.service.js';
import { learnerRecordingsSchema, practiceCreateSchema, practiceDraftSchema, practiceMachineAudioSchema, practiceReturnSchema } from './practice.schemas.js';

const rpcs = {
  ListPracticePrompts: { run: (service, { actor }) => service.listPrompts(actor) },
  CreatePracticePrompt: { payload: practiceCreateSchema, run: (service, { actor, payload }) => service.createPrompt(actor, payload) },
  GetPracticePrompt: { id: true, run: (service, { actor, id }) => service.getPrompt(actor, id) },
  SavePracticePromptDraft: { id: true, payload: practiceDraftSchema, run: (service, { actor, id, payload }) => service.saveDraft(actor, id, payload) },
  SubmitPracticePrompt: { id: true, run: (service, { actor, id }) => service.submitPrompt(actor, id) },
  WithdrawPracticePrompt: { id: true, run: (service, { actor, id }) => service.withdrawPrompt(actor, id) },
  ApprovePracticePrompt: { id: true, run: (service, { actor, id }) => service.approvePrompt(actor, id) },
  ReturnPracticePrompt: { id: true, payload: practiceReturnSchema, run: (service, { actor, id, payload }) => service.returnPrompt(actor, id, payload) },
  UnpublishPracticePrompt: { id: true, run: (service, { actor, id }) => service.unpublishPrompt(actor, id) },
  DeletePracticePrompt: { id: true, run: (service, { actor, id }) => service.deletePrompt(actor, id) },
  CreatePracticeMachineAudio: { payload: practiceMachineAudioSchema, run: (service, { actor, payload }) => service.createMachineAudio(actor, payload) },
  ListPublishedPracticePrompts: { internal: true, run: (service) => service.listPublished() },
  GetPracticePaper: { internal: true, id: true, run: (service, { id }) => service.paper(id) },
  DeleteLearnerRecordings: { internal: true, payload: learnerRecordingsSchema, run: (service, { payload }) => service.deleteRecordings(payload) },
  StoreLearnerRecording: { internal: true, upload: true, run: (service, { upload }) => service.storeRecording(upload) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

export class PracticeGrpcController {
  constructor(practiceService) {
    this.practiceService = practiceService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.practiceService, {
        actor: spec.internal ? undefined : actorSchema.parse(request.actor),
        id: spec.id ? idSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
        upload: spec.upload ? { mimeType: request.mimeType || '', data: request.data || new Uint8Array() } : undefined,
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

Controller()(PracticeGrpcController);
Inject(PracticeService)(PracticeGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  PracticeGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(PracticeGrpcController.prototype, method, rpc);
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(PracticeGrpcController.prototype, method, Object.getOwnPropertyDescriptor(PracticeGrpcController.prototype, method));
}

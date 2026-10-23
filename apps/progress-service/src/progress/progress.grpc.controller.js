import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { ProgressResponseCode } from '@appenglish/progress-contracts';
import { PROGRESS_GRPC_SERVICE } from '@appenglish/progress-contracts/grpc';
import { ProgressError } from './progress.errors.js';
import { actorSchema, markReadSchema } from './progress.schemas.js';
import { ProgressService } from './progress.service.js';

const rpcs = {
  GetProgress: { run: (service, { actor }) => service.getProgress(actor) },
  GetXp: { run: (service, { actor }) => service.getXp(actor) },
  GetLeaderboard: { run: (service, { actor }) => service.getLeaderboard(actor) },
  GetStreak: { run: (service, { actor }) => service.getStreak(actor) },
  GetLearnerSummary: { run: (service, { actor, id }) => service.getLearnerSummary(actor, id) },
  ListNotifications: { run: (service, { actor }) => service.listNotifications(actor) },
  MarkNotificationsRead: { payload: markReadSchema, run: (service, { actor, payload }) => service.markNotificationsRead(actor, payload) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

export class ProgressGrpcController {
  constructor(progressService) {
    this.progressService = progressService;
  }

  async handle(spec, request) {
    try {
      const payload = spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined;
      const data = await spec.run(this.progressService, { actor: actorSchema.parse(request.actor), id: request.id || '', payload });
      return this.toReply(200, ProgressResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof ProgressError) return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError') return this.toReply(400, ProgressResponseCode.VALIDATION_ERROR, 'fail', { issues: error.issues });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(ProgressGrpcController);
Inject(ProgressService)(ProgressGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  ProgressGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(ProgressGrpcController.prototype, method, rpc);
  GrpcMethod(PROGRESS_GRPC_SERVICE, rpc)(ProgressGrpcController.prototype, method, Object.getOwnPropertyDescriptor(ProgressGrpcController.prototype, method));
}

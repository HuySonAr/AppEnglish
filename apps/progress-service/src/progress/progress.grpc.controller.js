import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ProgressResponseCode } from '@appenglish/progress-contracts';
import { PROGRESS_GRPC_SERVICE } from '@appenglish/progress-contracts/grpc';
import { ProgressError } from './progress.errors.js';
import { actorSchema } from './progress.schemas.js';
import { ProgressService } from './progress.service.js';

// Each RPC and the service call it makes.
const rpcs = {
  GetProgress: { run: (service, { actor }) => service.getProgress(actor) },
  GetXp: { run: (service, { actor }) => service.getXp(actor) },
  GetLeaderboard: { run: (service, { actor }) => service.getLeaderboard(actor) },
  GetLearnerSummary: { run: (service, { actor, id }) => service.getLearnerSummary(actor, id) },
};

export class ProgressGrpcController {
  constructor(progressService) {
    this.progressService = progressService;
  }

  // Shapes the { code, msg, data } envelope. Unexpected errors propagate as a
  // gRPC error and the gateway answers 500.
  async handle(spec, request) {
    try {
      const data = await spec.run(this.progressService, { actor: actorSchema.parse(request.actor), id: request.id || '' });
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
  GrpcMethod(PROGRESS_GRPC_SERVICE, rpc)(ProgressGrpcController.prototype, method, Object.getOwnPropertyDescriptor(ProgressGrpcController.prototype, method));
}

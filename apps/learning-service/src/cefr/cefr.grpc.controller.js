import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { CefrService } from './cefr.service.js';

export class CefrGrpcController {
  constructor(cefrService) {
    this.cefrService = cefrService;
  }

  async getCefrProfile(request) {
    try {
      const data = await this.cefrService.getProfile(actorSchema.parse(request.actor));
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

Controller()(CefrGrpcController);
Inject(CefrService)(CefrGrpcController, undefined, 0);
withGrpcContext(CefrGrpcController.prototype, 'getCefrProfile', 'GetCefrProfile');
GrpcMethod(LEARNING_GRPC_SERVICE, 'GetCefrProfile')(CefrGrpcController.prototype, 'getCefrProfile', Object.getOwnPropertyDescriptor(CefrGrpcController.prototype, 'getCefrProfile'));

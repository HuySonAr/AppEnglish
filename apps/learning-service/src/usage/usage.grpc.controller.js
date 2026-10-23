import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { z } from 'zod';
import { ContentUsageKind } from '@appenglish/content-contracts';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { UsageRepository } from './usage.repository.js';

export const USAGE_REPOSITORY = Symbol('USAGE_REPOSITORY');

export const usageQuerySchema = z.object({
  kind: z.enum(Object.values(ContentUsageKind)),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export class UsageGrpcController {
  constructor(repository) {
    this.repository = repository;
  }

  async getContentUsage(request) {
    try {
      const query = usageQuerySchema.parse(JSON.parse(request.payloadJson || '{}'));
      const counts = await this.repository.countUsage(query.kind, [...new Set(query.ids)]);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      return this.toReply(200, LearningResponseCode.SUCCESS, 'success', { kind: query.kind, counts, total });
    } catch (error) {
      if (error?.name === 'ZodError' || error instanceof SyntaxError)
        return this.toReply(400, LearningResponseCode.VALIDATION_ERROR, 'fail', { issues: error.issues || [{ path: [], message: 'Payload is not valid JSON' }] });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(UsageGrpcController);
Inject(USAGE_REPOSITORY)(UsageGrpcController, undefined, 0);
withGrpcContext(UsageGrpcController.prototype, 'getContentUsage', 'GetContentUsage');
GrpcMethod(LEARNING_GRPC_SERVICE, 'GetContentUsage')(
  UsageGrpcController.prototype,
  'getContentUsage',
  Object.getOwnPropertyDescriptor(UsageGrpcController.prototype, 'getContentUsage'),
);
export { UsageRepository };

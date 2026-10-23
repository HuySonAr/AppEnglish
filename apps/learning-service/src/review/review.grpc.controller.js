import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { z } from 'zod';
import { LearningResponseCode, ReviewAction, TEACHER_REVIEW_LIMITS } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { ReviewService } from './review.service.js';

const idSchema = z.string().uuid();
const requestSchema = z.object({ submissionId: z.string().uuid() }).strict();
const completeSchema = z
  .object({
    action: z.enum(Object.values(ReviewAction)),
    scores: z.record(z.number()).optional().default({}),
    note: z.string().max(TEACHER_REVIEW_LIMITS.note).optional().default(''),
  })
  .strict();

const rpcs = {
  GetReviewQuota: { run: (service, { actor }) => service.getQuota(actor) },
  RequestReview: { payload: requestSchema, run: (service, { actor, payload }) => service.request(actor, payload) },
  WithdrawReview: { payload: requestSchema, run: (service, { actor, payload }) => service.withdraw(actor, payload) },
  ListReviewQueue: { run: (service, { actor }) => service.listQueue(actor) },
  ClaimReview: { id: true, run: (service, { actor, id }) => service.claim(actor, id) },
  GetReview: { id: true, run: (service, { actor, id }) => service.getReview(actor, id) },
  ReleaseReview: { id: true, run: (service, { actor, id }) => service.release(actor, id) },
  CompleteReview: { id: true, payload: completeSchema, run: (service, { actor, id, payload }) => service.complete(actor, id, payload) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new LearningError(LearningResponseCode.VALIDATION_ERROR, 'Payload is not valid JSON', 400, { issues: [{ path: [], message: 'Payload is not valid JSON' }] });
  }
}

export class ReviewGrpcController {
  constructor(reviewService) {
    this.reviewService = reviewService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.reviewService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? idSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
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

Controller()(ReviewGrpcController);
Inject(ReviewService)(ReviewGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  ReviewGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(ReviewGrpcController.prototype, method, rpc);
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(ReviewGrpcController.prototype, method, Object.getOwnPropertyDescriptor(ReviewGrpcController.prototype, method));
}

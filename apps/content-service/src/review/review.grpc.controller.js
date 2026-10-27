import { Controller, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { z } from 'zod';
import { CONTENT_REVIEW_NOTE_MAX, ContentResponseCode, ContentReviewKind, PLACEMENT_REVIEW_ID } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from '../content/content.errors.js';
import { actorSchema, idSchema } from '../content/content.schemas.js';
import { ContentReviewService } from './review.service.js';

const reviewIdSchema = z.union([idSchema, z.literal(PLACEMENT_REVIEW_ID)]);
const reviewKindSchema = z.object({ kind: z.enum(Object.values(ContentReviewKind)) }).strict();
const returnSchema = reviewKindSchema.extend({ note: z.string().trim().min(1).max(CONTENT_REVIEW_NOTE_MAX) }).strict();

const rpcs = {
  ListContentReviews: { run: (service, { actor }) => service.listQueue(actor) },
  SubmitContentReview: { schema: reviewKindSchema, run: (service, { actor, id, payload }) => service.submit(actor, { ...payload, id }) },
  WithdrawContentReview: { schema: reviewKindSchema, run: (service, { actor, id, payload }) => service.withdraw(actor, { ...payload, id }) },
  ApproveContentReview: { schema: reviewKindSchema, run: (service, { actor, id, payload }) => service.approve(actor, { ...payload, id }) },
  ReturnContentReview: { schema: returnSchema, run: (service, { actor, id, payload }) => service.returnForChanges(actor, { ...payload, id }) },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new ContentError(ContentResponseCode.VALIDATION_ERROR, 'Payload is not valid JSON', 400, {
      issues: [{ path: [], message: 'Payload is not valid JSON' }],
    });
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
        id: spec.schema ? reviewIdSchema.parse(request.id) : null,
        payload: spec.schema ? spec.schema.parse(parseJson(request.payloadJson)) : {},
      });
      return this.toReply(200, ContentResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof ContentError) return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError')
        return this.toReply(400, ContentResponseCode.VALIDATION_ERROR, 'fail', { issues: error.issues });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(ReviewGrpcController);
Inject(ContentReviewService)(ReviewGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  ReviewGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  withGrpcContext(ReviewGrpcController.prototype, method, rpc);
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(
    ReviewGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(ReviewGrpcController.prototype, method),
  );
}

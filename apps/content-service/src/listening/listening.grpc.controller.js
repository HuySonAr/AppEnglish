import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from '../content/content.errors.js';
import { actorSchema, idSchema, placementPaperSchema } from '../content/content.schemas.js';
import { ListeningService } from './listening.service.js';
import {
  listeningContentSchema,
  listeningExerciseCreateSchema,
  listeningExerciseUpdateSchema,
  listeningTopicCreateSchema,
  listeningTopicUpdateSchema,
} from './listening.schemas.js';

// Each RPC: whether it targets an id, the schema of its JSON payload (if any)
// and the service call.
const rpcs = {
  ListListeningTopics: { run: (service) => service.listTopics() },
  CreateListeningTopic: {
    payload: listeningTopicCreateSchema,
    run: (service, { actor, payload }) => service.createTopic(actor, payload),
  },
  UpdateListeningTopic: {
    id: true,
    payload: listeningTopicUpdateSchema,
    run: (service, { actor, id, payload }) => service.updateTopic(actor, id, payload),
  },
  ListListeningExercises: { run: (service, { actor }) => service.listExercises(actor) },
  CreateListeningExercise: {
    payload: listeningExerciseCreateSchema,
    run: (service, { actor, payload }) => service.createExercise(actor, payload),
  },
  UpdateListeningExercise: {
    id: true,
    payload: listeningExerciseUpdateSchema,
    run: (service, { actor, id, payload }) => service.updateExercise(actor, id, payload),
  },
  GetListeningExercise: { id: true, run: (service, { actor, id }) => service.getExercise(actor, id) },
  SaveListeningExerciseDraft: {
    id: true,
    payload: listeningContentSchema,
    run: (service, { actor, id, payload }) => service.saveDraft(actor, id, payload),
  },
  PublishListeningExercise: { id: true, run: (service, { actor, id }) => service.publish(actor, id) },
  // Called by learning-service, not by the gateway: there is no actor.
  ListPublishedListeningExercises: { internal: true, run: (service) => service.listPublished() },
  GetListeningPaper: {
    internal: true,
    id: true,
    payload: placementPaperSchema,
    run: (service, { id, payload }) => service.getPaper(id, payload),
  },
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

export class ListeningGrpcController {
  constructor(listeningService) {
    this.listeningService = listeningService;
  }

  // Shapes the { code, msg, data } envelope. Unexpected errors propagate as a
  // gRPC error and the gateway answers 500.
  async handle(spec, request) {
    try {
      const data = await spec.run(this.listeningService, {
        actor: spec.internal ? undefined : actorSchema.parse(request.actor),
        id: spec.id ? idSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
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

Controller()(ListeningGrpcController);
Inject(ListeningService)(ListeningGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  ListeningGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(
    ListeningGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(ListeningGrpcController.prototype, method),
  );
}

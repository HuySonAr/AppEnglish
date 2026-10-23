import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from '../placement/placement.errors.js';
import { actorSchema } from '../placement/placement.schemas.js';
import { ListeningPracticeService } from './listening.service.js';
import { dictationAnswersSchema, exerciseIdSchema, lineAnswersSchema, listeningOpenSchema } from './listening.schemas.js';

// Each RPC: whether it targets an exercise id, the schema of its JSON payload
// (if any) and the service call.
const rpcs = {
  ListListeningPractice: { run: (service, { actor }) => service.listPractice(actor) },
  GetListeningPractice: {
    id: true,
    payload: listeningOpenSchema,
    run: (service, { actor, id, payload }) => service.getExercise(actor, id, payload),
  },
  CheckListeningLine: {
    id: true,
    payload: lineAnswersSchema,
    run: (service, { actor, id, payload }) => service.checkLine(actor, id, payload),
  },
  GetListeningTranscript: { id: true, run: (service, { actor, id }) => service.getTranscript(actor, id) },
  CheckListeningPractice: {
    id: true,
    payload: dictationAnswersSchema,
    run: (service, { actor, id, payload }) => service.check(actor, id, payload),
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

export class ListeningGrpcController {
  constructor(listeningService) {
    this.listeningService = listeningService;
  }

  // Shapes the { code, msg, data } envelope. Unexpected errors propagate as a
  // gRPC error and the gateway answers 500.
  async handle(spec, request) {
    try {
      const data = await spec.run(this.listeningService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? exerciseIdSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
      });
      return this.toReply(200, LearningResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof LearningError) return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError')
        return this.toReply(400, LearningResponseCode.VALIDATION_ERROR, 'fail', { issues: error.issues });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(ListeningGrpcController);
Inject(ListeningPracticeService)(ListeningGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  ListeningGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(
    ListeningGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(ListeningGrpcController.prototype, method),
  );
}

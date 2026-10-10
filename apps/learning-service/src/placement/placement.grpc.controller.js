import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { LearningError } from './placement.errors.js';
import { PlacementService } from './placement.service.js';
import { actorSchema, answersSchema, settingsSchema } from './placement.schemas.js';

// Each RPC: the schema of its JSON payload (if any) and the service call.
const rpcs = {
  GetPlacement: { run: (service, { actor }) => service.getPlacement(actor) },
  StartPlacement: { run: (service, { actor }) => service.startPlacement(actor) },
  SavePlacementAnswers: {
    payload: answersSchema,
    run: (service, { actor, payload }) => service.savePlacementAnswers(actor, payload),
  },
  SubmitPlacement: {
    payload: answersSchema,
    run: (service, { actor, payload }) => service.submitPlacement(actor, payload),
  },
  SkipPlacement: { run: (service, { actor }) => service.skipPlacement(actor) },
  GetPlacementSettings: { run: (service, { actor }) => service.getPlacementSettings(actor) },
  UpdatePlacementSettings: {
    payload: settingsSchema,
    run: (service, { actor, payload }) => service.updatePlacementSettings(actor, payload),
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

export class PlacementGrpcController {
  constructor(placementService) {
    this.placementService = placementService;
  }

  // Shapes the { code, msg, data } envelope. Unexpected errors propagate as a
  // gRPC error and the gateway answers 500.
  async handle(spec, request) {
    try {
      const data = await spec.run(this.placementService, {
        actor: actorSchema.parse(request.actor),
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
      });
      return this.toReply(200, LearningResponseCode.SUCCESS, 'success', data);
    } catch (error) {
      if (error instanceof LearningError)
        return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError')
        return this.toReply(400, LearningResponseCode.VALIDATION_ERROR, 'fail', {
          issues: error.issues,
        });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(PlacementGrpcController);
Inject(PlacementService)(PlacementGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  PlacementGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  GrpcMethod(LEARNING_GRPC_SERVICE, rpc)(
    PlacementGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(PlacementGrpcController.prototype, method),
  );
}

import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from './content.errors.js';
import { ContentService } from './content.service.js';
import {
  actorSchema,
  idSchema,
  lessonContentSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  mediaUploadSchema,
  pronunciationSchema,
  unitCreateSchema,
  unitUpdateSchema,
} from './content.schemas.js';

// Each RPC: whether it targets an id, the schema of its JSON payload (if any)
// and the service call.
const rpcs = {
  ListUnits: { run: (service, { actor }) => service.listUnits(actor) },
  CreateUnit: {
    payload: unitCreateSchema,
    run: (service, { actor, payload }) => service.createUnit(actor, payload),
  },
  UpdateUnit: {
    id: true,
    payload: unitUpdateSchema,
    run: (service, { actor, id, payload }) => service.updateUnit(actor, id, payload),
  },
  PublishUnit: {
    id: true,
    run: (service, { actor, id }) => service.publishUnit(actor, id),
  },
  CreateLesson: {
    id: true,
    payload: lessonCreateSchema,
    run: (service, { actor, id, payload }) => service.createLesson(actor, id, payload),
  },
  UpdateLesson: {
    id: true,
    payload: lessonUpdateSchema,
    run: (service, { actor, id, payload }) => service.updateLesson(actor, id, payload),
  },
  GetLesson: {
    id: true,
    run: (service, { actor, id }) => service.getLesson(actor, id),
  },
  SaveLessonDraft: {
    id: true,
    payload: lessonContentSchema,
    run: (service, { actor, id, payload }) => service.saveLessonDraft(actor, id, payload),
  },
  PublishLesson: {
    id: true,
    run: (service, { actor, id }) => service.publishLesson(actor, id),
  },
  DeleteMedia: {
    id: true,
    run: (service, { actor, id }) => service.deleteMedia(actor, id),
  },
  AutofillPronunciation: {
    payload: pronunciationSchema,
    run: (service, { actor, payload }) => service.autofillPronunciation(actor, payload),
  },
};

function parseJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new ContentError(
      ContentResponseCode.VALIDATION_ERROR,
      'Payload is not valid JSON',
      400,
      { issues: [{ path: [], message: 'Payload is not valid JSON' }] },
    );
  }
}

export class ContentGrpcController {
  constructor(contentService) {
    this.contentService = contentService;
  }

  handle(spec, request) {
    return this.reply(() =>
      spec.run(this.contentService, {
        actor: actorSchema.parse(request.actor),
        id: spec.id ? idSchema.parse(request.id) : undefined,
        payload: spec.payload ? spec.payload.parse(parseJson(request.payloadJson)) : undefined,
      }),
    );
  }

  uploadMedia(request) {
    return this.reply(() =>
      this.contentService.uploadMedia(actorSchema.parse(request.actor), {
        ...mediaUploadSchema.parse({
          kind: request.kind,
          fileName: request.fileName,
          mimeType: request.mimeType,
          lessonId: request.lessonId,
          section: request.section,
        }),
        data: request.data,
      }),
    );
  }

  // Shapes the { code, msg, data } envelope. Unexpected errors propagate as a
  // gRPC error and the gateway answers 500.
  async reply(run) {
    try {
      return this.toReply(200, ContentResponseCode.SUCCESS, 'success', await run());
    } catch (error) {
      if (error instanceof ContentError)
        return this.toReply(error.status, error.code, 'fail', error.data);
      if (error?.name === 'ZodError')
        return this.toReply(400, ContentResponseCode.VALIDATION_ERROR, 'fail', {
          issues: error.issues,
        });
      throw error;
    }
  }

  toReply(httpStatus, code, msg, data) {
    return { httpStatus, code, msg, dataJson: JSON.stringify(data ?? {}), setCookies: [] };
  }
}

Controller()(ContentGrpcController);
Inject(ContentService)(ContentGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  ContentGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
}
for (const rpc of [...Object.keys(rpcs), 'UploadMedia']) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(
    ContentGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(ContentGrpcController.prototype, method),
  );
}

import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';
import { ContentError } from '../content/content.errors.js';
import { actorSchema, idSchema, versionRequestSchema } from '../content/content.schemas.js';
import { ContentVersionService } from './version.service.js';

// Version history (D122): id is the owner, the payload names the kind and,
// for one version, its id.
const rpcs = {
  ListContentVersions: { run: (service, { actor, id, payload }) => service.listVersions(actor, { ...payload, id }) },
  GetContentVersion: { run: (service, { actor, id, payload }) => service.getVersion(actor, { ...payload, id }) },
  RestoreContentVersion: { run: (service, { actor, id, payload }) => service.restoreVersion(actor, { ...payload, id }) },
  DiscardContentDraft: { run: (service, { actor, id, payload }) => service.discardDraft(actor, { ...payload, id }) },
  DeleteContentVersion: { run: (service, { actor, id, payload }) => service.deleteVersion(actor, { ...payload, id }) },
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

export class VersionGrpcController {
  constructor(versionService) {
    this.versionService = versionService;
  }

  async handle(spec, request) {
    try {
      const data = await spec.run(this.versionService, {
        actor: actorSchema.parse(request.actor),
        id: idSchema.parse(request.id),
        payload: versionRequestSchema.parse(parseJson(request.payloadJson)),
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

Controller()(VersionGrpcController);
Inject(ContentVersionService)(VersionGrpcController, undefined, 0);
for (const [rpc, spec] of Object.entries(rpcs)) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  VersionGrpcController.prototype[method] = function (request) {
    return this.handle(spec, request);
  };
  GrpcMethod(CONTENT_GRPC_SERVICE, rpc)(
    VersionGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(VersionGrpcController.prototype, method),
  );
}

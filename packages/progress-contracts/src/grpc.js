// Node-only gRPC contract helpers for api-gateway and progress-service. Keep
// this out of src/index.js so the web client can import the constants.
import { fileURLToPath } from 'node:url';

export const PROGRESS_GRPC_PACKAGE = 'appenglish.progress.v1';
export const PROGRESS_GRPC_SERVICE = 'ProgressService';
export const PROGRESS_PROTO_PATH = fileURLToPath(
  new URL('../proto/progress.proto', import.meta.url),
);

export const progressGrpcLoader = Object.freeze({
  keepCase: false,
  defaults: true,
  arrays: true,
  objects: true,
});

export function progressGrpcUrl(source = process.env) {
  return `${source.PROGRESS_GRPC_HOST || 'localhost'}:${source.PROGRESS_GRPC_PORT || 50054}`;
}

export function progressGrpcOptions(url = progressGrpcUrl()) {
  return {
    package: PROGRESS_GRPC_PACKAGE,
    protoPath: PROGRESS_PROTO_PATH,
    url,
    loader: progressGrpcLoader,
  };
}

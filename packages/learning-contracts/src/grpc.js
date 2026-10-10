// Node-only gRPC contract helpers for api-gateway and learning-service. Keep
// this out of src/index.js so the web client can import the constants.
import { fileURLToPath } from 'node:url';

export const LEARNING_GRPC_PACKAGE = 'appenglish.learning.v1';
export const LEARNING_GRPC_SERVICE = 'LearningService';
export const LEARNING_PROTO_PATH = fileURLToPath(
  new URL('../proto/learning.proto', import.meta.url),
);

export const learningGrpcLoader = Object.freeze({
  keepCase: false,
  defaults: true,
  arrays: true,
  objects: true,
});

export function learningGrpcUrl(source = process.env) {
  return `${source.LEARNING_GRPC_HOST || 'localhost'}:${source.LEARNING_GRPC_PORT || 50053}`;
}

export function learningGrpcOptions(url = learningGrpcUrl()) {
  return {
    package: LEARNING_GRPC_PACKAGE,
    protoPath: LEARNING_PROTO_PATH,
    url,
    loader: learningGrpcLoader,
  };
}

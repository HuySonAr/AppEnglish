// Node-only gRPC contract helpers for api-gateway and content-service. Keep
// this out of src/index.js so the web client can import the constants.
import { fileURLToPath } from 'node:url';

export const CONTENT_GRPC_PACKAGE = 'appenglish.content.v1';
export const CONTENT_GRPC_SERVICE = 'ContentService';
export const CONTENT_PROTO_PATH = fileURLToPath(
  new URL('../proto/content.proto', import.meta.url),
);

// Media uploads (default limit 10 MB) exceed gRPC's 4 MB default message size.
export const CONTENT_GRPC_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

export const contentGrpcLoader = Object.freeze({
  keepCase: false,
  defaults: true,
  arrays: true,
  objects: true,
});

export function contentGrpcUrl(source = process.env) {
  return `${source.CONTENT_GRPC_HOST || 'localhost'}:${source.CONTENT_GRPC_PORT || 50052}`;
}

export function contentGrpcOptions(url = contentGrpcUrl()) {
  return {
    package: CONTENT_GRPC_PACKAGE,
    protoPath: CONTENT_PROTO_PATH,
    url,
    loader: contentGrpcLoader,
    maxReceiveMessageLength: CONTENT_GRPC_MAX_MESSAGE_BYTES,
    maxSendMessageLength: CONTENT_GRPC_MAX_MESSAGE_BYTES,
  };
}

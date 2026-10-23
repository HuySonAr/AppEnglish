import { fileURLToPath } from 'node:url';

export const AUTH_GRPC_PACKAGE = 'appenglish.auth.v1';
export const AUTH_GRPC_SERVICE = 'AuthService';
export const AUTH_PROTO_PATH = fileURLToPath(
  new URL('../proto/auth.proto', import.meta.url),
);

export const authGrpcLoader = Object.freeze({
  keepCase: false,
  defaults: true,
  arrays: true,
  objects: true,
});

export function authGrpcUrl(source = process.env) {
  return `${source.AUTH_GRPC_HOST || 'localhost'}:${source.AUTH_GRPC_PORT || 50051}`;
}

export function authGrpcOptions(url = authGrpcUrl()) {
  return {
    package: AUTH_GRPC_PACKAGE,
    protoPath: AUTH_PROTO_PATH,
    url,
    loader: authGrpcLoader,
  };
}

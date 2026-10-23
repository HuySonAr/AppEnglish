import { observeGrpc } from './metrics.js';
import { requestIdFromMetadata, runWithRequestId } from './observability.js';

export function withGrpcContext(prototype, method, rpc = method) {
  const original = prototype[method];
  prototype[method] = function (data, metadata, ...rest) {
    const startedAt = Date.now();
    return runWithRequestId(requestIdFromMetadata(metadata), async () => {
      try {
        const reply = await original.call(this, data, metadata, ...rest);
        observeGrpc(rpc, startedAt, reply?.httpStatus >= 500 ? 'error' : reply?.httpStatus >= 400 ? 'refused' : 'ok');
        return reply;
      } catch (error) {
        observeGrpc(rpc, startedAt, 'error');
        throw error;
      }
    });
  };
}

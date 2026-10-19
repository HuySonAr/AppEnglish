import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';

// What progress-service reads from content-service over gRPC: the published
// curriculum, for the number of lessons to complete (D33).
export class ContentClient {
  constructor(grpcClient) {
    this.grpcClient = grpcClient;
  }

  async call(rpc, message) {
    this.service ||= this.grpcClient.getService(CONTENT_GRPC_SERVICE);
    const reply = await new Promise((resolve, reject) => {
      this.service[rpc](message).subscribe({ next: resolve, error: reject });
    });
    if (reply.httpStatus >= 400) throw new Error(`content-service answered ${reply.httpStatus}`);
    return JSON.parse(reply.dataJson);
  }

  // Published units in order, each with its published lessons in order.
  getCurriculum() {
    return this.call('getCurriculum', {});
  }
}

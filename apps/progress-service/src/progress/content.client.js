import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';

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

  getCurriculum() {
    return this.call('getCurriculum', {});
  }
}

import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';

// What learning-service reads from content-service over gRPC.
export class ContentClient {
  constructor(grpcClient) {
    this.grpcClient = grpcClient;
  }

  // The published placement version (the latest, or the given one) with its
  // answers; null when there is none.
  async getPlacementPaper(versionId) {
    this.service ||= this.grpcClient.getService(CONTENT_GRPC_SERVICE);
    const reply = await new Promise((resolve, reject) => {
      this.service
        .getPlacementPaper({ payloadJson: JSON.stringify(versionId ? { versionId } : {}) })
        .subscribe({ next: resolve, error: reject });
    });
    if (reply.httpStatus === 404) return null;
    if (reply.httpStatus >= 400) throw new Error(`content-service answered ${reply.httpStatus}`);
    return JSON.parse(reply.dataJson);
  }
}

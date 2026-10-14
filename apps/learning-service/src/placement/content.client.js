import { CONTENT_GRPC_SERVICE } from '@appenglish/content-contracts/grpc';

// What learning-service reads from content-service over gRPC.
export class ContentClient {
  constructor(grpcClient) {
    this.grpcClient = grpcClient;
  }

  // Calls one service-to-service RPC. Returns its data, or null when
  // content-service answers 404.
  async call(rpc, message) {
    this.service ||= this.grpcClient.getService(CONTENT_GRPC_SERVICE);
    const reply = await new Promise((resolve, reject) => {
      this.service[rpc](message).subscribe({ next: resolve, error: reject });
    });
    if (reply.httpStatus === 404) return null;
    if (reply.httpStatus >= 400) throw new Error(`content-service answered ${reply.httpStatus}`);
    return JSON.parse(reply.dataJson);
  }

  // The published placement version (the latest, or the given one) with its
  // answers; null when there is none.
  getPlacementPaper(versionId) {
    return this.call('getPlacementPaper', { payloadJson: JSON.stringify(versionId ? { versionId } : {}) });
  }

  // Published units in order, each with its published lessons in order.
  getCurriculum() {
    return this.call('getCurriculum', {});
  }

  // A lesson's published version (the current one, or the given one) with its
  // answers; null when the lesson is not published.
  getLessonPaper(lessonId, versionId) {
    return this.call('getLessonPaper', {
      id: lessonId,
      payloadJson: JSON.stringify(versionId ? { versionId } : {}),
    });
  }

  // Published mock tests with the number of questions in each part.
  listPublishedMockTests() {
    return this.call('listPublishedMockTests', {});
  }

  // The listening topics and the published dictation exercises (F05B-3).
  listPublishedListeningExercises() {
    return this.call('listPublishedListeningExercises', {});
  }

  // A dictation exercise's published version with its transcript; null when
  // it is not published.
  getListeningPaper(exerciseId) {
    return this.call('getListeningPaper', { id: exerciseId, payloadJson: '{}' });
  }

  // A mock test's published version (the current one, or the given one) with
  // its answers; null when the mock test is not published.
  getMockPaper(mockTestId, versionId) {
    return this.call('getMockPaper', {
      id: mockTestId,
      payloadJson: JSON.stringify(versionId ? { versionId } : {}),
    });
  }
}

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
    if (reply.httpStatus === 404) return null;
    if (reply.httpStatus >= 400) throw new Error(`content-service answered ${reply.httpStatus}`);
    return JSON.parse(reply.dataJson);
  }

  getPlacementPaper(versionId) {
    return this.call('getPlacementPaper', { payloadJson: JSON.stringify(versionId ? { versionId } : {}) });
  }

  getCurriculum() {
    return this.call('getCurriculum', {});
  }

  getLessonPaper(lessonId, versionId) {
    return this.call('getLessonPaper', {
      id: lessonId,
      payloadJson: JSON.stringify(versionId ? { versionId } : {}),
    });
  }

  getUnitReviewPaper(unitId, versionId) {
    return this.call('getUnitReviewPaper', {
      id: unitId,
      payloadJson: JSON.stringify(versionId ? { versionId } : {}),
    });
  }

  listPublishedMockTests() {
    return this.call('listPublishedMockTests', {});
  }

  listPublishedListeningExercises() {
    return this.call('listPublishedListeningExercises', {});
  }

  getListeningPaper(exerciseId) {
    return this.call('getListeningPaper', { id: exerciseId, payloadJson: '{}' });
  }

  listPublishedCourse() {
    return this.call('listPublishedCourse', {});
  }

  getCoursePaper(itemId, versionId) {
    return this.call('getCoursePaper', { id: itemId, payloadJson: JSON.stringify(versionId ? { versionId } : {}) });
  }

  listPublishedPracticePrompts() {
    return this.call('listPublishedPracticePrompts', {});
  }

  getPracticePaper(promptId) {
    return this.call('getPracticePaper', { id: promptId, payloadJson: '{}' });
  }

  storeLearnerRecording(mimeType, data) {
    return this.call('storeLearnerRecording', { kind: 'recording', fileName: '', mimeType, data, lessonId: '', section: '' });
  }

  deleteLearnerRecordings(recordings) {
    return this.call('deleteLearnerRecordings', { payloadJson: JSON.stringify({ recordings }) });
  }

  getMockPaper(mockTestId, versionId) {
    return this.call('getMockPaper', {
      id: mockTestId,
      payloadJson: JSON.stringify(versionId ? { versionId } : {}),
    });
  }
}

import { httpClient } from '../../../lib/api/http-client.js';

export async function getReviewQuota() {
  return (await httpClient.get('/learning/reviews/quota')).data;
}
export async function requestReview(submissionId) {
  return (await httpClient.post('/learning/reviews', { submissionId })).data;
}
export async function withdrawReview(submissionId) {
  return (await httpClient.post('/learning/reviews/withdraw', { submissionId })).data;
}
export async function requestSwReview(swTestId, section, attemptNumber) {
  return (await httpClient.post('/learning/reviews/sw-test', { swTestId, section, ...(attemptNumber ? { attemptNumber } : {}) })).data;
}

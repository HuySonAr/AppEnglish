import { httpClient } from '../../../lib/api/http-client.js';

export async function listReviewQueue() {
  return (await httpClient.get('/learning/reviews/queue')).data;
}
export async function claimReview(id) {
  return (await httpClient.post(`/learning/reviews/${id}/claim`)).data;
}
export async function getReview(id) {
  return (await httpClient.get(`/learning/reviews/${id}`)).data;
}
export async function releaseReview(id) {
  return (await httpClient.post(`/learning/reviews/${id}/release`)).data;
}
export async function completeReview(id, body) {
  return (await httpClient.post(`/learning/reviews/${id}/complete`, body)).data;
}

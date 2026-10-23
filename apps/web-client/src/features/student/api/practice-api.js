import { httpClient } from '../../../lib/api/http-client.js';

export async function listListeningPractice() {
  return (await httpClient.get('/learning/practice/listening')).data;
}
export async function getListeningPractice(id, mode = 'full') {
  return (await httpClient.get(`/learning/practice/listening/${id}`, { params: { mode } })).data;
}
export async function checkListeningPractice(id, answers, mode = 'full') {
  return (await httpClient.post(`/learning/practice/listening/${id}/check`, { mode, answers })).data;
}
export async function getListeningTranscript(id) {
  return (await httpClient.get(`/learning/practice/listening/${id}/transcript`)).data;
}
export async function checkListeningLine(id, segmentId, answers, mode = 'full') {
  return (await httpClient.post(`/learning/practice/listening/${id}/check-line`, { mode, segmentId, answers })).data;
}

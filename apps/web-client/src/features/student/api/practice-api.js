import { httpClient } from '../../../lib/api/http-client.js';

// Listening practice (F05B-3, D86): the published dictation exercises with
// the learner's best accuracy, one exercise without its transcript, and the
// check of what the learner wrote (answers: sentence id → text).
export async function listListeningPractice() {
  return (await httpClient.get('/learning/practice/listening')).data;
}
// mode: 'full' (write every sentence) or 'blanks' (fill in a song's blanks, D88).
export async function getListeningPractice(id, mode = 'full') {
  return (await httpClient.get(`/learning/practice/listening/${id}`, { params: { mode } })).data;
}
// answers: by sentence id in full mode, by blank number in blanks mode.
export async function checkListeningPractice(id, answers, mode = 'full') {
  return (await httpClient.post(`/learning/practice/listening/${id}/check`, { mode, answers })).data;
}
// One line checked as the learner goes (D93); nothing is kept.
export async function checkListeningLine(id, segmentId, answers, mode = 'full') {
  return (await httpClient.post(`/learning/practice/listening/${id}/check-line`, { mode, segmentId, answers })).data;
}

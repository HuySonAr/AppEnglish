import { httpClient } from '../../../lib/api/http-client.js';

const lesson = (id) => `/learning/lessons/${id}`;

export async function getCurriculum() {
  return (await httpClient.get('/learning/curriculum')).data;
}
export async function getLesson(id) {
  return (await httpClient.get(lesson(id))).data;
}
export async function markVocabularyStudied(id) {
  return (await httpClient.post(`${lesson(id)}/vocabulary/studied`)).data;
}
export async function getVocabularyQuiz(id, kind) {
  return (await httpClient.get(`${lesson(id)}/quiz/${kind}`)).data;
}
export async function submitVocabularyQuiz(id, kind, answers) {
  return (await httpClient.post(`${lesson(id)}/quiz/${kind}`, { answers })).data;
}
export async function submitFillIn(id, answers) {
  return (await httpClient.post(`${lesson(id)}/fill-in`, { answers })).data;
}
export async function getLessonTest(id) {
  return (await httpClient.get(`${lesson(id)}/test`)).data;
}
export async function startLessonTest(id) {
  return (await httpClient.post(`${lesson(id)}/test/start`)).data;
}
export async function saveLessonTestAnswers(id, answers) {
  return (await httpClient.put(`${lesson(id)}/test/answers`, { answers })).data;
}
export async function submitLessonTest(id, answers) {
  return (await httpClient.post(`${lesson(id)}/test/submit`, { answers })).data;
}
export async function discardLessonTest(id) {
  return (await httpClient.post(`${lesson(id)}/test/discard`)).data;
}
export async function getVocabularyPractice() {
  return (await httpClient.get('/learning/practice/vocabulary')).data;
}
export async function completeVocabularyPractice() {
  return (await httpClient.post('/learning/practice/vocabulary/complete')).data;
}
export async function getLessonTestReview(id, attemptNumber) {
  const suffix = attemptNumber ? `/${attemptNumber}` : '';
  return (await httpClient.get(`${lesson(id)}/test/review${suffix}`)).data;
}
export async function getLessonRanking(id) {
  return (await httpClient.get(`${lesson(id)}/ranking`)).data;
}
export async function getUnitReview(unitId) {
  return (await httpClient.get(`/learning/units/${unitId}/review`)).data;
}
export async function submitUnitReview(unitId, answers) {
  return (await httpClient.post(`/learning/units/${unitId}/review/submit`, { answers })).data;
}

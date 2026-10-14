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
// kind is QuizKind: this lesson's vocabulary, or the review of the previous lesson.
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
// Leaves the test in progress without submitting; it is removed (D82).
export async function discardLessonTest(id) {
  return (await httpClient.post(`${lesson(id)}/test/discard`)).data;
}
// The answers of one finished attempt; the latest when attemptNumber is omitted.
export async function getLessonTestReview(id, attemptNumber) {
  const suffix = attemptNumber ? `/${attemptNumber}` : '';
  return (await httpClient.get(`${lesson(id)}/test/review${suffix}`)).data;
}
export async function getLessonRanking(id) {
  return (await httpClient.get(`${lesson(id)}/ranking`)).data;
}

import { httpClient } from '../../../lib/api/http-client.js';

// Listening course (F05C, D100): the published course with the learner's
// results, one lesson without its answers, the check of one step as the
// learner goes, and the whole lesson scored and kept.
export async function getListeningCourse() {
  return (await httpClient.get('/learning/listening-course')).data;
}

const lessonPath = (unitId, lessonId) => `/learning/listening-course/units/${unitId}/lessons/${lessonId}`;

export async function getCourseLesson(unitId, lessonId) {
  return (await httpClient.get(lessonPath(unitId, lessonId))).data;
}
// body: { versionId, step: 'gist' | 'detail' | 'close', segmentId?, answers }.
export async function checkCourseLessonStep(unitId, lessonId, body) {
  return (await httpClient.post(`${lessonPath(unitId, lessonId)}/check`, body)).data;
}
// A unit check (itemId = the unit id) or a level test without its answers (D102).
export async function getCourseTest(itemId) {
  return (await httpClient.get(`/learning/listening-course/tests/${itemId}`)).data;
}
// answers: option id by question id.
export async function submitCourseTest(itemId, body) {
  return (await httpClient.post(`/learning/listening-course/tests/${itemId}/submit`, body)).data;
}
// answers: option id by question id, what was written by sentence id.
export async function completeCourseLesson(unitId, lessonId, body) {
  return (await httpClient.post(`${lessonPath(unitId, lessonId)}/complete`, body)).data;
}

// The listening placement (D103): taken or skipped once.
export async function getCoursePlacement() {
  return (await httpClient.get('/learning/listening-course/placement')).data;
}
export async function submitCoursePlacement(body) {
  return (await httpClient.post('/learning/listening-course/placement/submit', body)).data;
}
export async function skipCoursePlacement() {
  return (await httpClient.post('/learning/listening-course/placement/skip')).data;
}

// The learner's progress in the course, and the mistakes notebook (D104).
export async function getCourseProgress() {
  return (await httpClient.get('/learning/listening-course/progress')).data;
}
export async function listCourseMistakes() {
  return (await httpClient.get('/learning/listening-course/mistakes')).data;
}
// A sentence of the notebook written again.
export async function checkCourseMistake(id, text) {
  return (await httpClient.post(`/learning/listening-course/mistakes/${id}/check`, { text })).data;
}

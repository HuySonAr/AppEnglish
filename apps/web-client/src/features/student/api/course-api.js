import { httpClient } from '../../../lib/api/http-client.js';

// Listening course (D143–D145): the course by level with the learner's
// topics done and level tests, one topic with everything to study it, the
// check of one dictation sentence (nothing kept), the topic marked done, the
// level tests and the progress.
export async function getListeningCourse() {
  return (await httpClient.get('/learning/listening-course')).data;
}
export async function getCourseTopic(topicId) {
  return (await httpClient.get(`/learning/listening-course/topics/${topicId}`)).data;
}
// body: { versionId, segmentId, mode: 'full' | 'blanks', text?, blanks? }.
export async function checkCourseSentence(topicId, body) {
  return (await httpClient.post(`/learning/listening-course/topics/${topicId}/check`, body)).data;
}
export async function completeCourseTopic(topicId) {
  return (await httpClient.post(`/learning/listening-course/topics/${topicId}/complete`)).data;
}
// A level test without its answers.
export async function getCourseTest(itemId) {
  return (await httpClient.get(`/learning/listening-course/tests/${itemId}`)).data;
}
// answers: option id by question id.
export async function submitCourseTest(itemId, body) {
  return (await httpClient.post(`/learning/listening-course/tests/${itemId}/submit`, body)).data;
}
export async function getCourseProgress() {
  return (await httpClient.get('/learning/listening-course/progress')).data;
}

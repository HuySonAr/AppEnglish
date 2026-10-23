import { httpClient } from '../../../lib/api/http-client.js';

export async function getListeningCourse() {
  return (await httpClient.get('/learning/listening-course')).data;
}
export async function getCourseTopic(topicId) {
  return (await httpClient.get(`/learning/listening-course/topics/${topicId}`)).data;
}
export async function checkCourseSentence(topicId, body) {
  return (await httpClient.post(`/learning/listening-course/topics/${topicId}/check`, body)).data;
}
export async function completeCourseTopic(topicId) {
  return (await httpClient.post(`/learning/listening-course/topics/${topicId}/complete`)).data;
}
export async function getCourseTest(itemId) {
  return (await httpClient.get(`/learning/listening-course/tests/${itemId}`)).data;
}
export async function submitCourseTest(itemId, body) {
  return (await httpClient.post(`/learning/listening-course/tests/${itemId}/submit`, body)).data;
}
export async function getCourseProgress() {
  return (await httpClient.get('/learning/listening-course/progress')).data;
}

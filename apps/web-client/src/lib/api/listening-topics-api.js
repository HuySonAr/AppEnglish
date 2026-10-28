import { httpClient } from './http-client.js';

export async function listListeningTopics() {
  return (await httpClient.get('/content/listening-topics')).data;
}
export async function createListeningTopic(name, format, level = null) {
  return (await httpClient.post('/content/listening-topics', { name, format, level })).data;
}
export async function updateListeningTopic(id, changes) {
  return (await httpClient.patch(`/content/listening-topics/${id}`, changes)).data;
}
export async function deleteListeningTopic(id) {
  return (await httpClient.delete(`/content/listening-topics/${id}`)).data;
}
export async function listListeningTests() {
  return (await httpClient.get('/content/listening-tests')).data;
}
export async function createListeningTest(topicId, name) {
  return (await httpClient.post('/content/listening-tests', { topicId, name })).data;
}
export async function updateListeningTest(id, name) {
  return (await httpClient.patch(`/content/listening-tests/${id}`, { name })).data;
}
export async function deleteListeningTest(id) {
  return (await httpClient.delete(`/content/listening-tests/${id}`)).data;
}

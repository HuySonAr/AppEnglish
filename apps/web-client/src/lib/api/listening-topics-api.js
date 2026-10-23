import { httpClient } from './http-client.js';

export async function listListeningTopics() {
  return (await httpClient.get('/content/listening-topics')).data;
}
export async function createListeningTopic(name, format) {
  return (await httpClient.post('/content/listening-topics', { name, format })).data;
}
export async function updateListeningTopic(id, changes) {
  return (await httpClient.patch(`/content/listening-topics/${id}`, changes)).data;
}
export async function deleteListeningTopic(id) {
  return (await httpClient.delete(`/content/listening-topics/${id}`)).data;
}

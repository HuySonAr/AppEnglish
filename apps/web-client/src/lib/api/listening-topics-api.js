import { httpClient } from './http-client.js';

// Listening topics (TOEIC, …). Every role can list them; an Admin or a
// Content Manager can add or rename one (D85).
export async function listListeningTopics() {
  return (await httpClient.get('/content/listening-topics')).data;
}
// format: 'toeic', 'song' or null (no editor yet, D88).
export async function createListeningTopic(name, format) {
  return (await httpClient.post('/content/listening-topics', { name, format })).data;
}
// changes: { name?, format? }; the format is fixed once the topic has exercises.
export async function updateListeningTopic(id, changes) {
  return (await httpClient.patch(`/content/listening-topics/${id}`, changes)).data;
}

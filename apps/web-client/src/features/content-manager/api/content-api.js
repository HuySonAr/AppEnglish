import { httpClient } from '../../../lib/api/http-client.js';

export async function listUnits() {
  return (await httpClient.get('/content/units')).data;
}
export async function createUnit(payload) {
  return (await httpClient.post('/content/units', payload)).data;
}
export async function updateUnit(id, payload) {
  return (await httpClient.patch(`/content/units/${id}`, payload)).data;
}
export async function publishUnit(id) {
  return (await httpClient.post(`/content/units/${id}/publish`)).data;
}
export async function createLesson(unitId, payload) {
  return (await httpClient.post(`/content/units/${unitId}/lessons`, payload)).data;
}
export async function updateLesson(id, payload) {
  return (await httpClient.patch(`/content/lessons/${id}`, payload)).data;
}
export async function getLesson(id) {
  return (await httpClient.get(`/content/lessons/${id}`)).data;
}
export async function saveLessonDraft(id, content) {
  return (await httpClient.put(`/content/lessons/${id}/draft`, content)).data;
}
export async function publishLesson(id) {
  return (await httpClient.post(`/content/lessons/${id}/publish`)).data;
}
export async function autofillPronunciation(word, accents, lessonId) {
  // The dictionary lookup and audio downloads can take a while.
  return (await httpClient.post('/content/pronunciation', { word, accents, lessonId }, { timeout: 90000 })).data;
}
// The server keeps a file a saved version still uses; see deleted in the reply.
export async function deleteMedia(id) {
  return (await httpClient.delete(`/content/media/${id}`)).data;
}
// lessonId and section (vocabulary/test) decide the storage folder.
export async function uploadMedia({ kind, file, lessonId, section }) {
  const form = new FormData();
  form.set('kind', kind);
  form.set('lessonId', lessonId);
  form.set('section', section);
  form.set('file', file);
  // Uploads can be large; the default 5s client timeout is too short.
  return (await httpClient.post('/content/media', form, { timeout: 60000 })).data;
}

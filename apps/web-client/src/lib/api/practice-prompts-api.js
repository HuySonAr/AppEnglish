import { httpClient } from './http-client.js';

const base = '/content/practice-prompts';

export async function listPracticePrompts() {
  return (await httpClient.get(base)).data;
}
export async function createPracticePrompt(kind) {
  return (await httpClient.post(base, { kind })).data;
}
export async function getPracticePrompt(id) {
  return (await httpClient.get(`${base}/${id}`)).data;
}
export async function savePracticePromptDraft(id, content) {
  return (await httpClient.put(`${base}/${id}/draft`, { content })).data;
}
export async function submitPracticePrompt(id) {
  return (await httpClient.post(`${base}/${id}/submit`)).data;
}
export async function withdrawPracticePrompt(id) {
  return (await httpClient.post(`${base}/${id}/withdraw`)).data;
}
export async function approvePracticePrompt(id) {
  return (await httpClient.post(`${base}/${id}/approve`)).data;
}
export async function returnPracticePrompt(id, note) {
  return (await httpClient.post(`${base}/${id}/return`, { note })).data;
}
export async function unpublishPracticePrompt(id) {
  return (await httpClient.post(`${base}/${id}/unpublish`)).data;
}
export async function deletePracticePrompt(id) {
  return (await httpClient.delete(`${base}/${id}`)).data;
}
export async function uploadPracticeMedia(kind, file) {
  const form = new FormData();
  form.set('kind', kind);
  form.set('section', 'practice');
  form.set('file', file);
  return (await httpClient.post('/content/media', form, { timeout: 180000 })).data;
}
export async function createPracticeMachineAudio(text) {
  return (await httpClient.post(`${base}/machine-audio`, { text }, { timeout: 60000 })).data;
}

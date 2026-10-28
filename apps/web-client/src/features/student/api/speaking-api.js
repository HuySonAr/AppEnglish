import { httpClient } from '../../../lib/api/http-client.js';

export async function listSpeakingPrompts() {
  return (await httpClient.get('/learning/speaking/prompts')).data;
}
export async function getSpeakingPrompt(id) {
  return (await httpClient.get(`/learning/speaking/prompts/${id}`)).data;
}
export async function submitSpeaking(id, { blob, durationSeconds, questionIndex, setId }) {
  const form = new FormData();
  const type = blob.type.split(';')[0] || 'audio/webm';
  form.set('audio', blob, `recording.${type.split('/')[1] || 'webm'}`);
  form.set('durationSeconds', String(durationSeconds));
  if (questionIndex !== undefined && questionIndex !== null) form.set('questionIndex', String(questionIndex));
  if (setId) form.set('setId', setId);
  return (await httpClient.post(`/learning/speaking/prompts/${id}/submissions`, form, { timeout: 60000 })).data;
}
export async function getSpeakingSubmission(id) {
  return (await httpClient.get(`/learning/speaking/submissions/${id}`)).data;
}
export async function deleteSpeakingSubmission(id) {
  return (await httpClient.delete(`/learning/speaking/submissions/${id}`)).data;
}
export async function clearSpeakingPrompt(id) {
  return (await httpClient.delete(`/learning/speaking/prompts/${id}/submissions`)).data;
}

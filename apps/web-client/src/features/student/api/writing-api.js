import { httpClient } from '../../../lib/api/http-client.js';

export async function listWritingPrompts() {
  return (await httpClient.get('/learning/writing/prompts')).data;
}
export async function getWritingPrompt(id) {
  return (await httpClient.get(`/learning/writing/prompts/${id}`)).data;
}
export async function submitWriting(id, text) {
  return (await httpClient.post(`/learning/writing/prompts/${id}/submissions`, { text })).data;
}
export async function getWritingSubmission(id) {
  return (await httpClient.get(`/learning/writing/submissions/${id}`)).data;
}
export async function getAiKey() {
  return (await httpClient.get('/learning/ai-key')).data;
}
export async function saveAiKey(key) {
  return (await httpClient.put('/learning/ai-key', { key }, { timeout: 40000 })).data;
}
export async function deleteAiKey() {
  return (await httpClient.delete('/learning/ai-key')).data;
}

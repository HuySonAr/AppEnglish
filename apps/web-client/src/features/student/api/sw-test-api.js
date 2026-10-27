import { SwSection } from '@appenglish/content-contracts';
import { httpClient } from '../../../lib/api/http-client.js';

const base = (id) => `/learning/sw-tests/${id}`;

export async function listSwTests() {
  return (await httpClient.get('/learning/sw-tests')).data;
}
export async function getSwTest(id) {
  return (await httpClient.get(base(id))).data;
}
export async function startSwAttempt(id, section) {
  return (await httpClient.post(`${base(id)}/attempt/start`, { section })).data;
}
export async function saveSwRecording(id, { questionNumber, blob, durationSeconds }) {
  const form = new FormData();
  const type = blob.type.split(';')[0] || 'audio/webm';
  form.set('audio', blob, `answer-${questionNumber}.${type.split('/')[1] || 'webm'}`);
  form.set('questionNumber', String(questionNumber));
  form.set('durationSeconds', String(durationSeconds));
  return (await httpClient.post(`${base(id)}/attempt/recordings`, form, { timeout: 60000 })).data;
}
export async function skipSwQuestion(id, questionNumber) {
  return (await httpClient.post(`${base(id)}/attempt/skip`, { section: SwSection.SPEAKING, questionNumber })).data;
}
export async function saveSwAnswers(id, answers, lockThrough) {
  return (await httpClient.put(`${base(id)}/attempt/answers`, { section: SwSection.WRITING, answers, ...(lockThrough ? { lockThrough } : {}) })).data;
}
export async function submitSwAttempt(id, section) {
  return (await httpClient.post(`${base(id)}/attempt/submit`, { section }, { timeout: 30000 })).data;
}
export async function discardSwAttempt(id, section) {
  return (await httpClient.post(`${base(id)}/attempt/discard`, { section })).data;
}
export async function getSwResult(id, section, attemptNumber) {
  return (await httpClient.get(`${base(id)}/result`, { params: { section, ...(attemptNumber ? { attemptNumber } : {}) } })).data;
}
export async function retrySwScoring(id, section, attemptNumber) {
  return (await httpClient.post(`${base(id)}/result/retry`, { section, ...(attemptNumber ? { attemptNumber } : {}) }, { timeout: 30000 })).data;
}

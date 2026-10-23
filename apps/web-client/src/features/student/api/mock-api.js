import { httpClient } from '../../../lib/api/http-client.js';

const mock = (id) => `/mock-tests/${id}`;

export async function listMockTests() {
  return (await httpClient.get('/mock-tests')).data;
}
export async function getMockTest(id) {
  return (await httpClient.get(mock(id))).data;
}
export async function getMockAttempt(id, reference) {
  return (await httpClient.get(`${mock(id)}/attempt`, { params: reference })).data;
}
export async function startMockAttempt(id, reference) {
  return (await httpClient.post(`${mock(id)}/attempt/start`, reference)).data;
}
export async function saveMockAnswers(id, reference, answers) {
  return (await httpClient.put(`${mock(id)}/attempt/answers`, { ...reference, answers })).data;
}
export async function submitMockAttempt(id, reference, answers) {
  return (await httpClient.post(`${mock(id)}/attempt/submit`, { ...reference, answers })).data;
}
export async function discardMockAttempt(id, reference) {
  return (await httpClient.post(`${mock(id)}/attempt/discard`, reference)).data;
}
export async function getMockReview(id, reference, attemptNumber) {
  return (
    await httpClient.get(`${mock(id)}/review`, {
      params: { ...reference, ...(attemptNumber ? { attemptNumber } : {}) },
    })
  ).data;
}
export async function getMockMistakes() {
  return (await httpClient.get('/mock-tests/mistakes')).data;
}
export async function getMistakePractice(partKey) {
  return (await httpClient.get('/mock-tests/mistakes/practice', { params: partKey ? { partKey } : {} })).data;
}
export async function answerMistake(questionId, optionId) {
  return (await httpClient.post('/mock-tests/mistakes/answer', { questionId, optionId })).data;
}

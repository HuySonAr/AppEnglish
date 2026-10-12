import { httpClient } from './http-client.js';

// Exam types (TOEIC, …). Every role can list them; only an Admin can add or
// rename one.
export async function listExamTypes() {
  return (await httpClient.get('/content/exam-types')).data;
}
export async function createExamType(name) {
  return (await httpClient.post('/content/exam-types', { name })).data;
}
export async function renameExamType(id, name) {
  return (await httpClient.patch(`/content/exam-types/${id}`, { name })).data;
}

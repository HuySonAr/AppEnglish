import { httpClient } from '../../../lib/api/http-client.js';

export async function getStudyGoal() {
  return (await httpClient.get('/mock-tests/goal')).data;
}
export async function saveStudyGoal(goal) {
  return (await httpClient.put('/mock-tests/goal', goal)).data;
}
export async function deleteStudyGoal() {
  return (await httpClient.delete('/mock-tests/goal')).data;
}

import { httpClient } from '../../../lib/api/http-client.js';

export async function getPlacement() {
  return (await httpClient.get('/placement')).data;
}
export async function startPlacement() {
  return (await httpClient.post('/placement/start')).data;
}
export async function savePlacementAnswers(answers) {
  return (await httpClient.put('/placement/answers', { answers })).data;
}
export async function submitPlacement(answers) {
  return (await httpClient.post('/placement/submit', { answers })).data;
}
export async function skipPlacement() {
  return (await httpClient.post('/placement/skip')).data;
}

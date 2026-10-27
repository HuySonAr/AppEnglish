import { httpClient } from '../../../lib/api/http-client.js';

export async function getPlacementSettings() {
  return (await httpClient.get('/placement/settings')).data;
}
export async function updatePlacementSettings(settings) {
  return (await httpClient.put('/placement/settings', settings)).data;
}
export async function getScoreConversion() {
  return (await httpClient.get('/mock-tests/score-conversion')).data;
}
export async function updateScoreConversion(conversion) {
  return (await httpClient.put('/mock-tests/score-conversion', conversion)).data;
}
export async function getSwScoreConversion() {
  return (await httpClient.get('/learning/sw-tests/score-conversion')).data;
}
export async function updateSwScoreConversion(conversion) {
  return (await httpClient.put('/learning/sw-tests/score-conversion', conversion)).data;
}

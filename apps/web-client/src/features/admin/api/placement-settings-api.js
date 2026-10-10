import { httpClient } from '../../../lib/api/http-client.js';

export async function getPlacementSettings() {
  return (await httpClient.get('/placement/settings')).data;
}
export async function updatePlacementSettings(settings) {
  return (await httpClient.put('/placement/settings', settings)).data;
}

import { httpClient } from '../../../lib/api/http-client.js';

export async function getServicesHealth() {
  return (await httpClient.get('/health/services', { timeout: 10000 })).data;
}
export async function getSystemOverview() {
  return (await httpClient.get('/health/system', { timeout: 10000 })).data;
}

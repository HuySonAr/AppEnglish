import { httpClient } from '../../../lib/api/http-client.js';

// Admin dashboard (D115): whether each backend service answers.
export async function getServicesHealth() {
  return (await httpClient.get('/health/services', { timeout: 10000 })).data;
}

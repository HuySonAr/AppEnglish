import { httpClient } from '../../../lib/api/http-client.js';

export async function registerAccount(payload) {
  const response = await httpClient.post('/auth/register', payload);
  return response.data;
}

export async function loginAccount(payload) {
  const response = await httpClient.post('/auth/login', payload);
  return response.data;
}

import axios from 'axios';
import { installSessionRefresh } from './session-refresh.js';

export const httpClient = installSessionRefresh(
  axios.create({
    baseURL: import.meta.env.VITE_GATEWAY_URL || '',
    withCredentials: true,
    timeout: 5000
  })
);

export async function getGatewayHealth() {
  const response = await httpClient.get('/health');
  return response.data;
}

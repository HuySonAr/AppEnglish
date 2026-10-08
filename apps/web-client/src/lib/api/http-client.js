import axios from 'axios';

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000',
  timeout: 5000
});

export async function getGatewayHealth() {
  const response = await httpClient.get('/health');
  return response.data;
}

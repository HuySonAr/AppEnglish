import { httpClient } from '../../../lib/api/http-client.js';
import { adminAccountListParams } from '../../admin/api/account-query.js';

export async function registerAccount(payload) {
  const response = await httpClient.post('/auth/register', payload);
  return response.data;
}

export async function loginAccount(payload) {
  const response = await httpClient.post('/auth/login', payload);
  return response.data;
}

export async function getCurrentUser() {
  try {
    const response = await httpClient.get('/auth/me');
    return response.data;
  } catch (error) {
    if (error.response?.status !== 401) throw error;
    await httpClient.post('/auth/refresh');
    const response = await httpClient.get('/auth/me');
    return response.data;
  }
}

export async function logoutAccount() {
  const response = await httpClient.post('/auth/logout');
  return response.data;
}

export async function verifyEmail(payload) {
  return (await httpClient.post('/auth/verify-email', payload)).data;
}
export async function resendVerification(payload) {
  return (await httpClient.post('/auth/resend-verification', payload)).data;
}
export async function forgotPassword(payload) {
  return (await httpClient.post('/auth/forgot-password', payload)).data;
}
export async function resetPassword(payload) {
  return (await httpClient.post('/auth/reset-password', payload)).data;
}
export async function listAdminAccounts(params = {}) {
  return (await httpClient.get('/auth/admin/accounts', {
    params: adminAccountListParams(params),
  })).data;
}
export async function getAdminAccount(id) {
  return (await httpClient.get(`/auth/admin/accounts/${id}`)).data;
}
export async function updateAdminAccount(id, payload) {
  return (await httpClient.patch(`/auth/admin/accounts/${id}`, payload)).data;
}

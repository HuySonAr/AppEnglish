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
  // An expired access cookie is refreshed and replayed by the httpClient
  // interceptor (lib/api/session-refresh.js).
  const response = await httpClient.get('/auth/me');
  return response.data;
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
// Admin account management (D114).
export async function getAdminAccountStats() {
  return (await httpClient.get('/auth/admin/accounts/stats')).data;
}
export async function adminAccountAction(id, payload) {
  return (await httpClient.post(`/auth/admin/accounts/${id}/actions`, payload)).data;
}
// Invitations (D131): the admin creates the account; the person sets the
// password with the emailed code.
export async function inviteAdminAccount(payload) {
  return (await httpClient.post('/auth/admin/accounts', payload)).data;
}
export async function acceptInvite(payload) {
  return (await httpClient.post('/auth/accept-invite', payload)).data;
}

// Profile of the signed-in account (F09, D113).
export async function updateProfile(payload) {
  return (await httpClient.patch('/auth/profile', payload)).data;
}
export async function verifyPassword(payload) {
  return (await httpClient.post('/auth/profile/password/verify', payload)).data;
}
export async function changePassword(payload) {
  return (await httpClient.post('/auth/profile/password', payload)).data;
}
export async function uploadAvatar(file) {
  const form = new FormData();
  form.set('file', file);
  return (await httpClient.post('/auth/profile/avatar', form, { timeout: 60000 })).data;
}
export async function removeAvatar() {
  return (await httpClient.delete('/auth/profile/avatar')).data;
}

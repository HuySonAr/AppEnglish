import { httpClient } from './http-client.js';

const bases = {
  progress: '/progress/notifications',
  content: '/content/notifications',
  'content-admin': '/content/admin/notifications',
  'auth-admin': '/auth/admin/notifications',
};

export async function listNotifications(source) {
  return (await httpClient.get(bases[source])).data;
}
export async function markNotificationsRead(source, ids) {
  return (await httpClient.post(`${bases[source]}/read`, ids ? { ids } : {})).data;
}

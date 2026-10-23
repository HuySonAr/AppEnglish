import { httpClient } from '../../../lib/api/http-client.js';

export async function getLearnerSummary(accountId) {
  return (await httpClient.get(`/progress/admin/learners/${accountId}`)).data;
}

export async function resetLearnerPlacement(accountId, reason = '') {
  return (await httpClient.post(`/placement/admin/learners/${accountId}/reset`, reason ? { reason } : {})).data;
}

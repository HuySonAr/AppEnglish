import { httpClient } from '../../../lib/api/http-client.js';

// Admin (D114): one learner's progress and XP, read-only, from progress-service.
export async function getLearnerSummary(accountId) {
  return (await httpClient.get(`/progress/admin/learners/${accountId}`)).data;
}

// Admin (D131): removes the learner's placement attempt so they take the test
// again; the gateway writes the audit row with the reason.
export async function resetLearnerPlacement(accountId, reason = '') {
  return (await httpClient.post(`/placement/admin/learners/${accountId}/reset`, reason ? { reason } : {})).data;
}

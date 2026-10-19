import { httpClient } from '../../../lib/api/http-client.js';

// Admin (D114): one learner's progress and XP, read-only, from progress-service.
export async function getLearnerSummary(accountId) {
  return (await httpClient.get(`/progress/admin/learners/${accountId}`)).data;
}

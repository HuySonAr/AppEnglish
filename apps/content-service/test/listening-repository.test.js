import test from 'node:test';
import assert from 'node:assert/strict';
import { ListeningTimingJobEntity } from '../src/database/content.entities.js';
import { ListeningRepository } from '../src/listening/listening.repository.js';

test('the latest speech job is found by its owner', async () => {
  const seen = [];
  const dataSource = {
    isInitialized: true,
    getRepository(entity) {
      return { findOne: async (options) => (seen.push({ entity, options }), { id: 'job-1' }) };
    },
  };
  const repository = new ListeningRepository(dataSource);
  assert.deepEqual(await repository.findLatestTimingJob({ mockTestId: 'm-1' }), { id: 'job-1' });
  await repository.findLatestTimingJob({ exerciseId: 'e-1' });
  assert.equal(seen[0].entity, ListeningTimingJobEntity);
  assert.deepEqual(seen.map((call) => call.options.where), [{ mockTestId: 'm-1' }, { exerciseId: 'e-1' }]);
  assert.deepEqual(seen[0].options.order, { createdAt: 'DESC' });
});

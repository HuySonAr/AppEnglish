import test from 'node:test';
import assert from 'node:assert/strict';
import { ListeningTimingJobEntity } from '../src/database/content.entities.js';
import { ListeningRepository } from '../src/listening/listening.repository.js';

// D147: speech jobs belong to a library exercise or to a course topic; the
// latest job is looked up by whichever owner is given.
test('the latest speech job is found by its owner', async () => {
  const seen = [];
  const dataSource = {
    isInitialized: true,
    getRepository(entity) {
      return { findOne: async (options) => (seen.push({ entity, options }), { id: 'job-1' }) };
    },
  };
  const repository = new ListeningRepository(dataSource);
  assert.deepEqual(await repository.findLatestTimingJob({ courseItemId: 'c-1' }), { id: 'job-1' });
  await repository.findLatestTimingJob({ exerciseId: 'e-1' });
  assert.equal(seen[0].entity, ListeningTimingJobEntity);
  assert.deepEqual(seen.map((call) => call.options.where), [{ courseItemId: 'c-1' }, { exerciseId: 'e-1' }]);
  assert.deepEqual(seen[0].options.order, { createdAt: 'DESC' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { CefrService } from '../src/cefr/cefr.service.js';
import { student } from './helpers.js';

const attempt = (listeningScore, readingScore, day, kind = 'FULL') => ({ kind, listeningScore, readingScore, submittedAt: new Date(`2026-10-${day}T08:00:00Z`), mockTestId: `m${day}` });
const answer = (kind, level, total, day, teacherTotal) => ({
  kind,
  prompt: { level },
  result: { scores: { total } },
  teacherReview: teacherTotal === undefined ? null : { scores: { total: teacherTotal } },
  submittedAt: new Date(`2026-10-${String(day).padStart(2, '0')}T08:00:00Z`),
});

function service(attempts, submissions) {
  const asked = [];
  return {
    asked,
    service: new CefrService(
      { listFinishedAttempts: async () => attempts },
      { listScored: async (accountId, kinds) => (asked.push(kinds), submissions) },
    ),
  };
}

test('listening and reading come from the latest full mock with the ETS minimums', async () => {
  const { service: cefr } = service([attempt(300, 300, 10), attempt(405, 380, 12), attempt(495, 495, 13, 'MINI')], []);
  const { profile } = await cefr.getProfile(student);
  assert.deepEqual([profile.listening.level, profile.listening.score, profile.reading.level, profile.reading.score, profile.listening.mockTestId], ['B2', 405, 'B1', 380, 'm12']);
  const empty = await service([], []).service.getProfile(student);
  assert.deepEqual([empty.profile.listening.level, empty.profile.speaking.level, empty.profile.writing.level], [null, null, null]);
  await assert.rejects(() => cefr.getProfile({ id: student.id, role: 'TEACHER' }), { code: 26 });
});

test('speaking counts open answers only and writing uses 3.5/5; teacher scores win; 3 of the last 5 per level', async () => {
  const submissions = [
    answer('open_speaking', 'B1', 7.2, 1),
    answer('open_speaking', 'B1', 6, 2, 7.5),
    answer('open_speaking', 'B1', 7, 3),
    answer('open_speaking', 'B2', 9, 4),
    answer('read_aloud', 'C1', 9.5, 5),
    answer('read_aloud', 'C1', 9.5, 6),
    answer('read_aloud', 'C1', 9.5, 7),
    answer('writing', 'A2', 3.5, 8),
    answer('writing', 'A2', 4, 9),
    answer('writing', 'A2', 3, 10),
    answer('writing', 'A2', 3.6, 11),
    answer('writing', 'B1', null, 12),
  ];
  const { service: cefr, asked } = service([], submissions);
  const { profile } = await cefr.getProfile(student);
  assert.deepEqual(asked[0], ['open_speaking', 'writing']);
  assert.equal(profile.speaking.level, 'B1');
  assert.deepEqual(profile.speaking.levels, [{ level: 'B1', considered: 3, passed: 3 }, { level: 'B2', considered: 1, passed: 1 }]);
  assert.equal(profile.writing.level, 'A2');
  assert.deepEqual([profile.writing.pass, profile.writing.max, profile.speaking.needed, profile.speaking.recent], [3.5, 5, 3, 5]);

  const slipping = [...Array(5)].map((_, index) => answer('open_speaking', 'B1', index < 3 ? 5 : 8, 20 + index)).concat([answer('open_speaking', 'B1', 8, 1), answer('open_speaking', 'B1', 8, 2), answer('open_speaking', 'B1', 8, 3)]);
  assert.equal((await service([], slipping).service.getProfile(student)).profile.speaking.level, null);
});

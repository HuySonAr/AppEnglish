import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLeaderboard, pageOfRank } from './leaderboard.js';

test('the leaderboard is narrowed by email without changing ranks', () => {
  const entries = [
    { rank: 1, email: 'anna@appenglish.test', totalXp: 95 },
    { rank: 2, email: 'binh.nguyen@appenglish.test', totalXp: 90 },
    { rank: 3, email: 'Chí@appenglish.test', totalXp: 90 },
  ];
  assert.deepEqual(filterLeaderboard(entries).map((entry) => entry.rank), [1, 2, 3]);
  assert.deepEqual(filterLeaderboard(entries, { search: 'binh' }).map((entry) => entry.rank), [2]);
  // Case and accents do not matter.
  assert.deepEqual(filterLeaderboard(entries, { search: 'CHI' }).map((entry) => entry.rank), [3]);
  assert.deepEqual(filterLeaderboard(entries, { search: 'nobody' }), []);
});

test('the page holding a rank', () => {
  assert.equal(pageOfRank(1, 10), 1);
  assert.equal(pageOfRank(10, 10), 1);
  assert.equal(pageOfRank(11, 10), 2);
  assert.equal(pageOfRank(null, 10), 1);
});

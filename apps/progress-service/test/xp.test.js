import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LearningEventType } from '@appenglish/learning-contracts';
import { rankTotals, totalsOf, xpOf } from '../src/progress/xp.rules.js';
import { manager, message, mockTest, otherStudent, progressHarness, student } from './helpers.js';

const { MOCK_SUBMITTED } = LearningEventType;
const third = { id: '66666666-6666-4666-8666-666666666666', role: 'STUDENT' };

test('XP of a mock test is the share of right answers scaled to 100 and rounded', () => {
  assert.equal(xpOf(200, 200), 100);
  assert.equal(xpOf(0, 200), 0);
  assert.equal(xpOf(133, 200), 67); // 66.5 rounds to 67
  assert.equal(xpOf(9, 13), 69);
  assert.equal(xpOf(5, 0), 0);
});

test('the leaderboard ranks by total XP, then by who reached it first', () => {
  const rows = [
    { accountId: 'a', accountEmail: 'a@x', mockTestId: '1', xp: 60, earnedAt: '2026-10-17T08:00:00Z' },
    { accountId: 'a', accountEmail: 'a2@x', mockTestId: '2', xp: 30, earnedAt: '2026-10-17T10:00:00Z' },
    { accountId: 'b', accountEmail: 'b@x', mockTestId: '1', xp: 90, earnedAt: '2026-10-17T09:00:00Z' },
    { accountId: 'c', accountEmail: 'c@x', mockTestId: '1', xp: 50, earnedAt: '2026-10-17T07:00:00Z' },
  ];
  const ranked = rankTotals(totalsOf(rows));
  // a and b both have 90: b reached it at 09:00, a only at 10:00, so b is first.
  assert.deepEqual(
    ranked.map((entry) => [entry.rank, entry.accountId, entry.totalXp, entry.mockCount, entry.accountEmail]),
    [
      [1, 'b', 90, 1, 'b@x'],
      [2, 'a', 90, 2, 'a2@x'],
      [3, 'c', 50, 1, 'c@x'],
    ],
  );
  assert.deepEqual(rankTotals([]), []);
});

test('only the first full attempt of a mock test earns XP; the learner sees their total, rank and tests', async () => {
  const { service, repository } = progressHarness();
  const level1 = randomUUID();
  const level2 = randomUUID();
  const first = mockTest(student.id, level1, { listening: 60, listeningTotal: 100, reading: 40, readingTotal: 100, minute: 1, email: 'me@x', title: 'Level 1 test' });
  // A retake with a better score: counts for mastery, not for XP (D63).
  const retake = mockTest(student.id, level1, { attemptNumber: 2, listening: 90, listeningTotal: 100, reading: 90, readingTotal: 100, minute: 2, email: 'me@x', title: 'Level 1 test' });
  const second = mockTest(student.id, level2, { listening: 30, listeningTotal: 100, reading: 50, readingTotal: 100, minute: 3, email: 'me@x', title: 'Level 2 test' });
  const mini = mockTest(student.id, level2, { kind: 'MINI', listening: 10, listeningTotal: 10, reading: 0, readingTotal: 0, minute: 4 });
  for (const item of [first, retake, second, mini, first]) await service.applyResult(message(MOCK_SUBMITTED, item));
  assert.deepEqual(repository.tables.xp.map((row) => [row.mockTestTitle, row.xp]), [['Level 1 test', 50], ['Level 2 test', 40]]);

  await service.applyResult(message(MOCK_SUBMITTED, mockTest(otherStudent.id, level1, { listening: 95, listeningTotal: 100, reading: 95, readingTotal: 100, minute: 5, email: 'other@x' })));
  await service.applyResult(message(MOCK_SUBMITTED, mockTest(third.id, level1, { listening: 90, listeningTotal: 100, reading: 90, readingTotal: 100, minute: 0, email: 'third@x' })));

  await assert.rejects(() => service.getXp(manager), { code: 26, status: 403 });
  const xp = await service.getXp(student);
  // 90 total; otherStudent has 95, third has 90 too but reached it earlier.
  assert.deepEqual([xp.totalXp, xp.rank, xp.learnerCount], [90, 3, 3]);
  assert.deepEqual(
    xp.entries.map((entry) => [entry.mockTestTitle, entry.xp, entry.correctCount, entry.totalCount, entry.earnedAt]),
    [
      ['Level 2 test', 40, 80, 200, '2026-10-17T08:03:00.000Z'],
      ['Level 1 test', 50, 100, 200, '2026-10-17T08:01:00.000Z'],
    ],
  );

  const board = await service.getLeaderboard(student);
  assert.deepEqual(
    board.entries.map((entry) => [entry.rank, entry.email, entry.totalXp, entry.mockCount, entry.isYou]),
    [
      [1, 'other@x', 95, 1, false],
      [2, 'third@x', 90, 1, false],
      [3, 'me@x', 90, 2, true],
    ],
  );
  assert.deepEqual([board.learnerCount, board.you.rank, board.you.totalXp], [3, 3, 90]);

  // A learner without XP has no rank and no place on the board.
  const nobody = { id: '77777777-7777-4777-8777-777777777777', role: 'STUDENT' };
  assert.deepEqual(await service.getXp(nobody), { totalXp: 0, rank: null, learnerCount: 3, entries: [] });
  assert.equal((await service.getLeaderboard(nobody)).you, null);
});

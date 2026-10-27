import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonRing, memberFor, skillBars, xpBars } from './profile-charts.js';

test('skill bars keep null while a skill has no test', () => {
  const bars = skillBars({ skills: { listening: { percent: 72, testCount: 3 }, reading: { percent: null, testCount: 0 } } });
  assert.deepEqual(bars.map((bar) => [bar.label, bar.percent, bar.tests]), [['Listening', 72, 3], ['Reading', null, 0]]);
  assert.deepEqual(skillBars(null).map((bar) => bar.percent), [null, null]);
});

test('the lessons ring is completed over published, with no percent without lessons', () => {
  assert.deepEqual(lessonRing({ completion: { completedLessons: 3, totalLessons: 8 } }), { completed: 3, total: 8, remaining: 5, percent: 38 });
  assert.deepEqual(lessonRing({ completion: { completedLessons: 0, totalLessons: 0 } }), { completed: 0, total: 0, remaining: 0, percent: null });
  assert.equal(lessonRing({ completion: { completedLessons: 9, totalLessons: 8 } }).remaining, 0);
});

test('xp bars are in the order earned with shortened titles', () => {
  const bars = xpBars({
    entries: [
      { mockTestId: 'b', mockTestTitle: 'A very long mock test title indeed', xp: 60, correctCount: 60, totalCount: 100, earnedAt: '2026-10-18T10:00:00Z' },
      { mockTestId: 'a', mockTestTitle: 'Level 1', xp: 80, correctCount: 80, totalCount: 100, earnedAt: '2026-10-17T10:00:00Z' },
    ],
  });
  assert.deepEqual(bars.map((bar) => [bar.id, bar.short, bar.xp]), [['a', 'Level 1', 80], ['b', 'A very long mock…', 60]]);
  assert.deepEqual(xpBars(null), []);
});

test('membership length', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  assert.equal(memberFor('2026-10-19T08:00:00Z', now), 'today');
  assert.equal(memberFor('2026-10-18T08:00:00Z', now), '1 day');
  assert.equal(memberFor('2026-10-01T08:00:00Z', now), '18 days');
  assert.equal(memberFor('2026-07-01T08:00:00Z', now), '3 months');
  assert.equal(memberFor('nonsense', now), '');
});

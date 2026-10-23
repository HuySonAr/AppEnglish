import test from 'node:test';
import assert from 'node:assert/strict';
import { bestMockPercent, greeting, lessonStats, nextLessonStep, suggestedMockTest } from './home.js';

const lesson = (id, state) => ({ id, title: `Lesson ${id}`, state, bestPercent: null });
const curriculum = (placementRequired, units) => ({ placementRequired, startUnit: 1, units });

test('the next step is the placement, then the first open lesson, then done', () => {
  assert.equal(nextLessonStep(null), null);
  assert.deepEqual(nextLessonStep(curriculum(true, [])), { kind: 'placement' });
  const units = [
    { id: 'u1', title: 'One', lessons: [lesson('a', 'COMPLETED'), lesson('b', 'COMPLETED')] },
    { id: 'u2', title: 'Two', lessons: [lesson('c', 'OPEN'), lesson('d', 'LOCKED')] },
  ];
  const next = nextLessonStep(curriculum(false, units));
  assert.deepEqual([next.kind, next.lesson.id, next.unit.id], ['lesson', 'c', 'u2']);
  assert.equal(nextLessonStep(curriculum(false, [{ id: 'u1', title: 'One', lessons: [lesson('a', 'OPEN'), lesson('b', 'OPEN')] }])).lesson.id, 'a');
  assert.deepEqual(nextLessonStep(curriculum(false, [{ id: 'u1', title: 'One', lessons: [lesson('a', 'COMPLETED')] }])), { kind: 'done' });
  assert.deepEqual(nextLessonStep(curriculum(false, [])), { kind: 'none' });
});

test('lesson stats count completed lessons and find the current unit', () => {
  const units = [
    { id: 'u1', title: 'One', lessons: [lesson('a', 'COMPLETED'), lesson('b', 'COMPLETED')] },
    { id: 'u2', title: 'Two', lessons: [lesson('c', 'OPEN'), lesson('d', 'LOCKED')] },
  ];
  const stats = lessonStats(curriculum(false, units));
  assert.deepEqual([stats.completed, stats.total, stats.currentUnit.id], [2, 4, 'u2']);
  assert.deepEqual(lessonStats(null), { completed: 0, total: 0, currentUnit: null });
  assert.equal(lessonStats(curriculum(false, [{ id: 'u1', title: 'One', lessons: [lesson('a', 'COMPLETED')] }])).currentUnit, null);
});

test('the suggested mock test is a recommended one not taken yet', () => {
  const mock = (id, level, recommended, attemptCount, bestPercent = null) => ({ id, title: id, level, recommended, attemptCount, bestPercent });
  assert.equal(suggestedMockTest(null), null);
  assert.equal(suggestedMockTest({ mockTests: [] }), null);
  const tests = [mock('l1', 1, false, 0), mock('l2a', 2, true, 2, 71), mock('l2b', 2, true, 0), mock('l3', 3, false, 1, 40)];
  assert.equal(suggestedMockTest({ mockTests: tests }).id, 'l2b');
  assert.equal(suggestedMockTest({ mockTests: [mock('l2a', 2, true, 2, 71), mock('l2b', 2, true, 1, 50)] }).id, 'l2b');
  assert.equal(suggestedMockTest({ mockTests: [mock('l1', 1, false, 1, 60), mock('l3', 3, false, 0)] }).id, 'l3');
  assert.equal(suggestedMockTest({ mockTests: [mock('l1', 1, false, 1, 60)] }).id, 'l1');
  assert.equal(bestMockPercent({ mockTests: tests }), 71);
  assert.equal(bestMockPercent({ mockTests: [mock('l1', 1, false, 0)] }), null);
});

test('the greeting follows the hour', () => {
  assert.equal(greeting(new Date('2026-10-17T08:00:00')), 'Good morning');
  assert.equal(greeting(new Date('2026-10-17T13:00:00')), 'Good afternoon');
  assert.equal(greeting(new Date('2026-10-17T20:00:00')), 'Good evening');
});

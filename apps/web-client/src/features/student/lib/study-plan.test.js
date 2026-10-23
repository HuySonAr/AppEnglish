import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPlan, goalSummary } from './study-plan.js';

const now = new Date('2026-10-23T03:00:00Z');
const mocks = { mockTests: [{ id: 'm1', level: 1, recommended: true, attemptCount: 1 }] };
const curriculum = { placementRequired: false, units: [{ id: 'u', number: 2, title: 'Travel', lessons: [{ id: 'l', number: 4, title: 'At the airport', state: 'OPEN' }] }] };
const course = { currentLevel: 'A2', levels: [{ level: 'A2', topics: [{ id: 't', title: 'Ordering food', done: false }] }] };
const parts = [{ key: 'part5', number: 5, rate: 40, shown: 6 }];

test('the goal summary gives the gap, the weeks left and the points a week', () => {
  const summary = goalSummary({ goal: { targetScore: 650, examDate: '2026-12-18' }, estimate: { total: 565 } }, now);
  assert.deepEqual([summary.gap, summary.daysLeft, summary.weeksLeft, summary.perWeek, summary.percent, summary.reached], [85, 56, 8, 11, 87, false]);
  assert.deepEqual(goalSummary({ goal: { targetScore: 500, examDate: null }, estimate: { total: 520 } }, now).reached, true);
  const noScore = goalSummary({ goal: { targetScore: 600, examDate: null }, estimate: null }, now);
  assert.deepEqual([noScore.current, noScore.gap, noScore.perWeek, noScore.percent], [null, null, null, 0]);
  assert.equal(goalSummary({ goal: null }, now), null);
});

test('without a score the plan starts with a full test; then the weakest part, the next lesson and listening', () => {
  const first = dailyPlan({ goal: { estimate: null, parts: [], weakestPart: null }, curriculum, course, mocks }, now);
  assert.deepEqual(first.map((task) => task.key), ['full', 'lesson', 'listening']);

  const goal = { estimate: { total: 565, listening: 300, reading: 265, at: '2026-10-20T03:00:00Z' }, parts, weakestPart: 'part5' };
  const plan = dailyPlan({ goal, curriculum, course, mocks }, now);
  assert.deepEqual(plan.map((task) => task.key), ['mini', 'lesson', 'listening']);
  assert.deepEqual([plan[0].title, plan[0].state, plan[0].to], ['Part 5 mini test', { startMini: 'part5' }, '/student/mock-tests/m1']);

  const listeningWeak = dailyPlan({ goal: { ...goal, estimate: { ...goal.estimate, listening: 200, reading: 365 } }, curriculum, course, mocks }, now);
  assert.deepEqual(listeningWeak.map((task) => task.key), ['mini', 'listening', 'lesson']);

  const stale = dailyPlan({ goal: { ...goal, estimate: { ...goal.estimate, at: '2026-09-01T00:00:00Z' } }, curriculum, course, mocks }, now);
  assert.deepEqual(stale.map((task) => task.key), ['full', 'mini', 'lesson']);
  assert.deepEqual(dailyPlan({ goal: null, curriculum: { placementRequired: true, units: [] }, course: null, mocks: { mockTests: [] } }, now).map((task) => task.key), ['placement']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPlan, goalSummary } from './study-plan.js';

const now = new Date('2026-10-23T03:00:00Z');
const mocks = { mockTests: [{ id: 'm1', level: 1, recommended: true, attemptCount: 1 }] };
const curriculum = { placementRequired: false, units: [{ id: 'u', number: 2, title: 'Travel', lessons: [{ id: 'l', number: 4, title: 'At the airport', state: 'OPEN' }] }] };
const parts = [{ key: 'part5', number: 5, rate: 40, shown: 6 }];

test('the goal summary gives the gap, the weeks left and the points a week', () => {
  const summary = goalSummary({ goal: { lr: { targetScore: 650, examDate: '2026-12-18' }, sw: null }, estimate: { total: 565 } }, now);
  assert.equal(summary.sw, null);
  assert.deepEqual([summary.lr.gap, summary.lr.daysLeft, summary.lr.weeksLeft, summary.lr.perWeek, summary.lr.percent, summary.lr.reached], [85, 56, 8, 11, 87, false]);
  assert.deepEqual(goalSummary({ goal: { lr: { targetScore: 500, examDate: null }, sw: null }, estimate: { total: 520 } }, now).lr.reached, true);
  const noScore = goalSummary({ goal: { lr: { targetScore: 600, examDate: null }, sw: null }, estimate: null }, now).lr;
  assert.deepEqual([noScore.current, noScore.gap, noScore.perWeek, noScore.percent], [null, null, null, 0]);
  assert.equal(goalSummary({ goal: null }, now), null);
});

test('the S&W summary keeps each target and counts the days to its own exam', () => {
  const summary = goalSummary({ goal: { lr: null, sw: { speakingTarget: 150, writingTarget: null, examDate: '2026-11-02' } }, estimate: { total: 565 } }, now);
  assert.equal(summary.lr, null);
  assert.deepEqual(summary.sw, { speakingTarget: 150, writingTarget: null, examDate: '2026-11-02', daysLeft: 10, speakingNow: null, writingNow: null });
  const scored = goalSummary({ goal: { lr: null, sw: { speakingTarget: 150, writingTarget: 140, examDate: null } }, sw: { estimate: { speaking: { scaled: 130, reviewed: true, swTestId: 's1' }, writing: null } } }, now);
  assert.deepEqual([scored.sw.speakingNow.scaled, scored.sw.speakingNow.reviewed, scored.sw.writingNow], [130, true, null]);
});

test('without a score the plan starts with a full test; then the weakest part and the next lesson', () => {
  const first = dailyPlan({ goal: { estimate: null, parts: [], weakestPart: null }, curriculum, mocks }, now);
  assert.deepEqual(first.map((task) => task.key), ['full', 'lesson']);

  const goal = { estimate: { total: 565, listening: 300, reading: 265, at: '2026-10-20T03:00:00Z' }, parts, weakestPart: 'part5' };
  const plan = dailyPlan({ goal, curriculum, mocks }, now);
  assert.deepEqual(plan.map((task) => task.key), ['mini', 'lesson']);
  assert.deepEqual([plan[0].title, plan[0].state, plan[0].to], ['Part 5 mini test', { startMini: 'part5' }, '/student/mock-tests/m1']);

  const stale = dailyPlan({ goal: { ...goal, estimate: { ...goal.estimate, at: '2026-09-01T00:00:00Z' } }, curriculum, mocks }, now);
  assert.deepEqual(stale.map((task) => task.key), ['full', 'mini', 'lesson']);
  assert.deepEqual(dailyPlan({ goal: null, curriculum: { placementRequired: true, units: [] }, mocks: { mockTests: [] } }, now).map((task) => task.key), ['placement']);
});

const lrGoal = { estimate: { total: 565, listening: 300, reading: 265, at: '2026-10-20T03:00:00Z' }, parts, weakestPart: 'part5' };
const swOnly = (sw, activity = {}) => ({ goal: { lr: null, sw: { speakingTarget: null, writingTarget: null, examDate: null, ...sw } }, estimate: null, parts: [], weakestPart: null, sw: { lastTest: { speaking: null, writing: null }, practiced: {}, ...activity } });

test('an S&W goal adds a test for each part with a target when none was taken in 14 days', () => {
  const plan = dailyPlan({ goal: swOnly({ speakingTarget: 150, writingTarget: 170 }), curriculum, mocks }, now);
  assert.deepEqual(plan.map((task) => task.key), ['sw-test-speaking', 'sw-test-writing', 'sw-practice']);
  assert.deepEqual([plan[0].title, plan[0].to], ['Take a Speaking test', '/student/sw-tests']);

  const recent = dailyPlan({ goal: swOnly({ speakingTarget: 150, writingTarget: 170 }, { lastTest: { speaking: '2026-10-20T00:00:00Z', writing: '2026-09-01T00:00:00Z' } }), curriculum, mocks }, now);
  assert.deepEqual(recent.map((task) => task.key), ['sw-test-writing', 'sw-practice']);
  assert.match(recent[0].detail, /over 14 days/);

  const writingOnly = dailyPlan({ goal: swOnly({ writingTarget: 170 }), curriculum, mocks }, now);
  assert.deepEqual(writingOnly.map((task) => task.key), ['sw-test-writing', 'sw-practice']);
});

test('the practice item picks a never practised task type first, then the one practised longest ago', () => {
  const tested = { lastTest: { speaking: '2026-10-22T00:00:00Z', writing: '2026-10-22T00:00:00Z' } };
  const fresh = dailyPlan({ goal: swOnly({ speakingTarget: 150 }, { ...tested, practiced: { read_aloud: '2026-10-21T00:00:00Z' } }), curriculum, mocks }, now);
  assert.deepEqual(fresh.map((task) => task.key), ['sw-practice']);
  assert.deepEqual([fresh[0].etsTask, fresh[0].to, fresh[0].title], ['describe_picture', '/student/practice/speaking?etsTask=describe_picture&level=all', 'Practise: Describe a picture']);

  const practiced = { picture_sentence: '2026-10-20T00:00:00Z', respond_email: '2026-10-10T00:00:00Z', opinion_essay: '2026-10-15T00:00:00Z', describe_picture: '2026-10-01T00:00:00Z' };
  const oldest = dailyPlan({ goal: swOnly({ writingTarget: 170 }, { ...tested, practiced }), curriculum, mocks }, now);
  assert.deepEqual([oldest[0].etsTask, oldest[0].to], ['respond_email', '/student/practice/writing?etsTask=respond_email&level=all']);
  assert.match(oldest[0].detail, /longest ago/);
});

test('with both groups the plan alternates L&R and S&W up to 4 items; without a goal it stays L&R only', () => {
  const stale = { ...lrGoal, estimate: { ...lrGoal.estimate, at: '2026-09-01T00:00:00Z' } };
  const both = { ...stale, goal: { lr: { targetScore: 650, examDate: null }, sw: { speakingTarget: 150, writingTarget: 170, examDate: null } }, sw: { lastTest: { speaking: null, writing: null }, practiced: {} } };
  assert.deepEqual(dailyPlan({ goal: both, curriculum, mocks }, now).map((task) => task.key), ['full', 'sw-test-speaking', 'mini', 'sw-test-writing']);

  const lrOnly = { ...stale, goal: { lr: { targetScore: 650, examDate: null }, sw: null }, sw: both.sw };
  assert.deepEqual(dailyPlan({ goal: lrOnly, curriculum, mocks }, now).map((task) => task.key), ['full', 'mini', 'lesson']);
  assert.deepEqual(dailyPlan({ goal: { ...stale, goal: null, sw: both.sw }, curriculum, mocks }, now).map((task) => task.key), ['full', 'mini', 'lesson']);
  assert.deepEqual(dailyPlan({ goal: swOnly({ speakingTarget: 150 }), curriculum, mocks }, now).every((task) => task.key.startsWith('sw-')), true);
});

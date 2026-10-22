import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayOf, streakOf, streakView, weekStart } from '../src/progress/streak.rules.js';
import { manager, message, progressHarness, student } from './helpers.js';

test('days are counted in Vietnam time and weeks start on Monday', () => {
  assert.equal(dayOf(new Date('2026-10-21T16:59:59Z')), '2026-10-21');
  assert.equal(dayOf(new Date('2026-10-21T17:00:00Z')), '2026-10-22');
  assert.equal(weekStart('2026-10-22'), '2026-10-19');
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.equal(weekStart('2026-10-25'), '2026-10-19');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('one day off a week keeps the streak; a second one breaks it', () => {
  const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
  const kept = streakOf([...days, '2026-10-19'], '2026-10-19');
  assert.deepEqual([kept.current, kept.longest, kept.studiedToday], [7, 7, true]);
  assert.equal(kept.stateOf('2026-10-18'), 'rest');

  const broken = streakOf(['2026-10-19', '2026-10-21', '2026-10-24'], '2026-10-24');
  assert.equal(broken.stateOf('2026-10-20'), 'rest');
  assert.equal(broken.stateOf('2026-10-22'), 'missed');
  assert.deepEqual([broken.current, broken.longest], [1, 2]);
});

test('today not studied yet does not break the streak', () => {
  const result = streakOf(['2026-10-20', '2026-10-21'], '2026-10-22');
  assert.deepEqual([result.current, result.studiedToday, result.stateOf('2026-10-22')], [2, false, 'today']);
  const afterRest = streakOf(['2026-10-19', '2026-10-20'], '2026-10-22');
  assert.deepEqual([afterRest.current, afterRest.stateOf('2026-10-21')], [2, 'rest']);
  assert.equal(streakOf(['2026-10-19'], '2026-10-22').current, 0);
});

test('the view gives this week and an eight-week calendar', () => {
  const view = streakView(['2026-10-20', '2026-10-21'], new Date('2026-10-22T03:00:00Z'));
  assert.equal(view.today, '2026-10-22');
  assert.deepEqual(view.week.map((day) => day.state), ['missed', 'studied', 'studied', 'today', 'future', 'future', 'future']);
  assert.equal(view.calendar.length, 8);
  assert.equal(view.calendar[7][0].day, '2026-10-19');
  assert.deepEqual([view.current, view.longest, view.restPerWeek], [2, 2, 1]);
  assert.deepEqual(streakView([], new Date('2026-10-22T03:00:00Z')).current, 0);
});

test('activity events become study days and the student reads the streak', async () => {
  const { service, repository } = progressHarness([1], { now: () => new Date('2026-10-22T03:00:00Z') });
  const activity = (kind, occurredAt) => message('activity.recorded', { accountId: student.id, activity: kind, occurredAt });
  await service.applyResult(activity('lessonStep', '2026-10-20T02:00:00.000Z'));
  await service.applyResult(activity('wordMemory', '2026-10-21T16:30:00.000Z'));
  await service.applyResult(activity('mockTest', '2026-10-21T18:00:00.000Z'));
  await service.applyResult(activity('mockTest', '2026-10-21T19:00:00.000Z'));
  assert.deepEqual(repository.tables.studyDays.map((row) => [row.day, row.activities]), [
    ['2026-10-20', ['lessonStep']],
    ['2026-10-21', ['wordMemory']],
    ['2026-10-22', ['mockTest']],
  ]);
  const streak = await service.getStreak(student);
  assert.deepEqual([streak.current, streak.studiedToday, streak.today], [3, true, '2026-10-22']);
  await assert.rejects(() => service.getStreak(manager), { code: 26 });
  await assert.rejects(() => service.applyResult(message('activity.recorded', { accountId: student.id, activity: 'chat', occurredAt: '2026-10-22T03:00:00.000Z' })), { name: 'ZodError' });
});


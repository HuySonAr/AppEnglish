import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hourOf, needsStreakReminder } from '../src/progress/notification.rules.js';
import { manager, message, mockTest, progressHarness, student } from './helpers.js';

test('the streak reminder is due from 18:00 Vietnam time, only for a live streak not studied today', () => {
  assert.equal(hourOf(new Date('2026-10-22T10:59:00Z')), 17);
  assert.equal(hourOf(new Date('2026-10-22T11:00:00Z')), 18);
  const evening = new Date('2026-10-22T12:00:00Z');
  assert.equal(needsStreakReminder({ current: 3, studiedToday: false }, evening), true);
  assert.equal(needsStreakReminder({ current: 3, studiedToday: true }, evening), false);
  assert.equal(needsStreakReminder({ current: 0, studiedToday: false }, evening), false);
  assert.equal(needsStreakReminder({ current: 3, studiedToday: false }, new Date('2026-10-22T03:00:00Z')), false);
});

test('results become notifications once; the learner lists and reads them (D163)', async () => {
  const clock = { now: new Date('2026-10-22T03:00:00Z') };
  const { service, repository } = progressHarness([1], { now: () => new Date(clock.now) });
  const mockId = randomUUID();
  const first = mockTest(student.id, mockId, { listening: 5, listeningTotal: 10, reading: 5, readingTotal: 10, title: 'Level 1 test' });
  const firstMessage = message('mock.submitted', first);
  await service.applyResult(firstMessage);
  await service.applyResult(firstMessage);
  const second = mockTest(student.id, mockId, { attemptNumber: 2, listening: 8, listeningTotal: 10, reading: 7, readingTotal: 10, minute: 30, title: 'Level 1 test' });
  second.listeningScore = 350;
  second.readingScore = 300;
  await service.applyResult(message('mock.submitted', second));
  await service.applyResult(message('mock.submitted', mockTest(student.id, mockId, { kind: 'MINI', listening: 1, listeningTotal: 2, reading: 0, readingTotal: 0 })));
  const unitId = randomUUID();
  const opened = { accountId: student.id, unitId, unitTitle: 'Unit 1', nextUnitId: randomUUID(), nextUnitTitle: 'Unit 2', passedAt: '2026-10-21T09:00:00.000Z' };
  await service.applyResult(message('unit-review.passed', opened));
  await service.applyResult(message('unit-review.passed', opened));
  await service.applyResult(message('course.level-up', { accountId: student.id, from: 'A1', to: 'A2', reachedAt: '2026-10-21T10:00:00.000Z' }));

  await assert.rejects(() => service.listNotifications(manager), { code: 26 });
  const listed = await service.listNotifications(student);
  assert.equal(listed.unread, 4);
  assert.deepEqual(listed.notifications.map((item) => item.kind), ['COURSE_LEVEL_UP', 'UNIT_OPENED', 'MOCK_RESULT', 'MOCK_RESULT']);
  const results = listed.notifications.filter((item) => item.kind === 'MOCK_RESULT').map((item) => [item.data.attemptNumber, item.data.total, item.data.change]);
  assert.deepEqual(results, [[1, first.listeningScore + first.readingScore, null], [2, 650, 650 - first.listeningScore - first.readingScore]].sort((a, b) => b[0] - a[0]));
  assert.deepEqual(listed.notifications[1].data, { unitId, unitTitle: 'Unit 1', nextUnitId: opened.nextUnitId, nextUnitTitle: 'Unit 2' });

  const one = listed.notifications[0].id;
  assert.deepEqual(await service.markNotificationsRead(student, { ids: [one] }), { unread: 3 });
  assert.deepEqual(await service.markNotificationsRead(student, {}), { unread: 0 });
  assert.equal((await service.listNotifications(student)).notifications.every((item) => item.read), true);
  assert.equal(repository.tables.notifications.length, 4);
});

test('the evening reminder appears once a day and is read once the learner studies; old ones go after 30 days', async () => {
  const clock = { now: new Date('2026-10-21T03:00:00Z') };
  const { service, repository } = progressHarness([1], { now: () => new Date(clock.now) });
  const study = (at) => service.applyResult(message('activity.recorded', { accountId: student.id, activity: 'lessonStep', occurredAt: at }));
  await study('2026-10-20T03:00:00.000Z');
  await study('2026-10-21T03:00:00.000Z');
  clock.now = new Date('2026-10-22T12:00:00Z');
  const evening = await service.listNotifications(student);
  assert.deepEqual(evening.notifications.map((item) => [item.kind, item.data.streak, item.read]), [['STREAK_REMINDER', 2, false]]);
  await service.listNotifications(student);
  assert.equal(repository.tables.notifications.length, 1);
  await study('2026-10-22T12:30:00.000Z');
  clock.now = new Date('2026-10-22T13:00:00Z');
  const studied = await service.listNotifications(student);
  assert.deepEqual([studied.unread, studied.notifications[0].read], [0, true]);
  clock.now = new Date('2026-11-25T03:00:00Z');
  assert.deepEqual((await service.listNotifications(student)).notifications, []);
});

test('a scored or failed reading becomes one notification, and speaking counts as a study day (F12)', async () => {
  const { service } = progressHarness([1], { now: () => new Date('2026-10-23T03:00:00Z') });
  const submissionId = randomUUID();
  const scored = { accountId: student.id, submissionId, promptId: randomUUID(), kind: 'read_aloud', title: 'Train times', status: 'DONE', total: 8.1, scoredAt: '2026-10-23T02:00:00.000Z' };
  await service.applyResult(message('speaking.scored', scored));
  await service.applyResult(message('speaking.scored', scored));
  await service.applyResult(message('speaking.scored', { ...scored, submissionId: randomUUID(), status: 'FAILED', total: null }));
  await service.applyResult(message('activity.recorded', { accountId: student.id, activity: 'speaking', occurredAt: '2026-10-23T02:00:00.000Z' }));
  const listed = await service.listNotifications(student);
  assert.deepEqual(listed.notifications.map((item) => [item.kind, item.data.status, item.data.total]).sort(), [['SPEAKING_RESULT', 'DONE', 8.1], ['SPEAKING_RESULT', 'FAILED', null]]);
  const streak = await service.getStreak(student);
  assert.equal(streak.studiedToday, true);
});

test('a scored writing becomes a WRITING_RESULT notification (F13)', async () => {
  const { service } = progressHarness([1], { now: () => new Date('2026-10-23T03:00:00Z') });
  const submissionId = randomUUID();
  const scored = { accountId: student.id, submissionId, promptId: randomUUID(), kind: 'writing', title: 'Day off', status: 'DONE', total: 3.6, scoredAt: '2026-10-23T02:00:00.000Z' };
  await service.applyResult(message('writing.scored', scored));
  await service.applyResult(message('speaking.scored', { ...scored, kind: 'read_aloud' }));
  const listed = await service.listNotifications(student);
  assert.deepEqual(listed.notifications.map((item) => item.kind).sort(), ['SPEAKING_RESULT', 'WRITING_RESULT']);
});

test('a teacher review and a returned review become notifications (F15)', async () => {
  const { service } = progressHarness([1], { now: () => new Date('2026-10-23T03:00:00Z') });
  const base = { accountId: student.id, submissionId: randomUUID(), promptId: randomUUID(), kind: 'writing', title: 'Day off' };
  await service.applyResult(message('review.completed', { ...base, total: 3.6, reviewedAt: '2026-10-23T02:00:00.000Z' }));
  await service.applyResult(message('review.expired', { ...base, submissionId: randomUUID(), expiredAt: '2026-10-23T02:30:00.000Z' }));
  const listed = await service.listNotifications(student);
  assert.deepEqual(listed.notifications.map((item) => [item.kind, item.data.total]), [['REVIEW_RETURNED', null], ['TEACHER_REVIEWED', 3.6]]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LearningEventType } from '@appenglish/learning-contracts';
import { bestBySkill, completion, skillMastery } from '../src/progress/progress.rules.js';
import { lessonTest, manager, message, mockTest, otherStudent, progressHarness, student } from './helpers.js';

const { LESSON_TEST_SUBMITTED, LESSON_COMPLETED, MOCK_SUBMITTED } = LearningEventType;

test('mastery of a skill averages the best share of each test; a skill without tests has no value', () => {
  const lesson = randomUUID();
  const mock = randomUUID();
  const results = [
    { source: 'LESSON_TEST', sourceId: lesson, listeningCorrect: 4, listeningTotal: 9, readingCorrect: 14, readingTotal: 14 },
    // A retake raises listening to 8/9; reading drops, but the best is kept.
    { source: 'LESSON_TEST', sourceId: lesson, listeningCorrect: 8, listeningTotal: 9, readingCorrect: 7, readingTotal: 14 },
    { source: 'MOCK_TEST', sourceId: mock, listeningCorrect: 50, listeningTotal: 100, readingCorrect: 0, readingTotal: 0 },
  ];
  assert.deepEqual(bestBySkill(results), [
    { source: 'LESSON_TEST', sourceId: lesson, listening: 8 / 9, reading: 1 },
    { source: 'MOCK_TEST', sourceId: mock, listening: 0.5, reading: null },
  ]);
  // (8/9 + 0.5) / 2 = 69.4%; reading rests on the lesson test alone.
  assert.deepEqual(skillMastery(results, 'listening'), { percent: 69, testCount: 2, lessonTests: 1, mockTests: 1 });
  assert.deepEqual(skillMastery(results, 'reading'), { percent: 100, testCount: 1, lessonTests: 1, mockTests: 0 });
  assert.deepEqual(skillMastery([], 'reading'), { percent: null, testCount: 0, lessonTests: 0, mockTests: 0 });
  // Exact values stay exact until shown: 2/3 of one test shows 67, not 66 (D39).
  assert.equal(skillMastery([{ source: 'LESSON_TEST', sourceId: lesson, listeningCorrect: 6, listeningTotal: 9, readingCorrect: 0, readingTotal: 14 }], 'listening').percent, 67);
});

test('completion counts the published lessons only', () => {
  const curriculum = {
    units: [
      { id: 'u1', title: 'One', lessons: [{ id: 'a' }, { id: 'b' }] },
      { id: 'u2', title: 'Two', lessons: [{ id: 'c' }] },
    ],
  };
  // 'gone' was completed but is no longer published: it neither counts nor blocks.
  assert.deepEqual(completion([{ lessonId: 'a' }, { lessonId: 'gone' }], curriculum), {
    completedLessons: 1,
    totalLessons: 3,
    percent: 33,
    units: [
      { id: 'u1', title: 'One', completed: 1, total: 2 },
      { id: 'u2', title: 'Two', completed: 0, total: 1 },
    ],
  });
  assert.deepEqual(completion([], { units: [] }), { completedLessons: 0, totalLessons: 0, percent: null, units: [] });
});

test('a learner without results sees no data, not zero; other roles are refused', async () => {
  const { service } = progressHarness([2, 1]);
  await assert.rejects(() => service.getProgress(manager), { code: 26, status: 403 });
  const progress = await service.getProgress(student);
  assert.deepEqual(progress, {
    completion: {
      completedLessons: 0,
      totalLessons: 3,
      percent: 0,
      units: [
        { id: progress.completion.units[0].id, title: 'Unit 1', completed: 0, total: 2 },
        { id: progress.completion.units[1].id, title: 'Unit 2', completed: 0, total: 1 },
      ],
    },
    skills: {
      listening: { percent: null, testCount: 0, lessonTests: 0, mockTests: 0 },
      reading: { percent: null, testCount: 0, lessonTests: 0, mockTests: 0 },
    },
    attempts: { lessonTests: 0, mockTests: 0 },
  });
});

test('results and completions from learning-service build the progress; a message applied twice counts once', async () => {
  const { service, repository, content } = progressHarness([2, 1]);
  const [first, second] = content.lessons;
  const mock = randomUUID();

  const failed = message(LESSON_TEST_SUBMITTED, lessonTest(student.id, first.id, { listening: 5, reading: 10, minute: 1 }));
  const passed = message(LESSON_TEST_SUBMITTED, lessonTest(student.id, first.id, { attemptNumber: 2, listening: 9, reading: 12, minute: 2 }));
  const completed = message(LESSON_COMPLETED, { accountId: student.id, lessonId: first.id, completedAt: '2026-10-17T08:02:00.000Z' });
  const full = message(MOCK_SUBMITTED, mockTest(student.id, mock, { listening: 60, listeningTotal: 100, reading: 40, readingTotal: 100, minute: 3 }));
  for (const item of [failed, passed, completed, full, passed, completed, full]) assert.equal(await service.applyResult(item), true);
  assert.deepEqual([repository.tables.results.length, repository.tables.completions.length], [3, 1]);

  // Another learner's results stay theirs.
  await service.applyResult(message(LESSON_TEST_SUBMITTED, lessonTest(otherStudent.id, second.id, { listening: 9, reading: 14 })));
  await service.applyResult(message(LESSON_COMPLETED, { accountId: otherStudent.id, lessonId: second.id, completedAt: '2026-10-17T08:05:00.000Z' }));

  const progress = await service.getProgress(student);
  assert.deepEqual(progress.completion.completedLessons, 1);
  assert.deepEqual(progress.completion.units.map((unit) => [unit.completed, unit.total]), [[1, 2], [0, 1]]);
  assert.equal(progress.completion.percent, 33);
  // Listening: lesson best 9/9, mock 60/100 → 80%. Reading: lesson best 12/14, mock 40/100 → (0.857 + 0.4) / 2 = 63%.
  assert.deepEqual(progress.skills.listening, { percent: 80, testCount: 2, lessonTests: 1, mockTests: 1 });
  assert.deepEqual(progress.skills.reading, { percent: 63, testCount: 2, lessonTests: 1, mockTests: 1 });
  assert.deepEqual(progress.attempts, { lessonTests: 2, mockTests: 1 });

  const other = await service.getProgress(otherStudent);
  assert.deepEqual([other.completion.completedLessons, other.skills.reading.percent], [1, 100]);
});

test('a mini test or an unknown type is ignored; a malformed message is refused', async () => {
  const { service, repository } = progressHarness();
  const mini = mockTest(student.id, randomUUID(), { kind: 'MINI', listening: 0, listeningTotal: 0, reading: 5, readingTotal: 10 });
  assert.equal(await service.applyResult(message(MOCK_SUBMITTED, mini)), false);
  assert.equal(await service.applyResult(message('something.else', { any: 1 })), false);
  assert.equal(repository.tables.results.length, 0);
  await assert.rejects(() => service.applyResult({ type: LESSON_COMPLETED, payload: {} }), { name: 'ZodError' });
  await assert.rejects(() => service.applyResult(message(LESSON_COMPLETED, { accountId: student.id })), { name: 'ZodError' });
  await assert.rejects(() => service.applyResult(message(LESSON_TEST_SUBMITTED, { ...lessonTest(student.id, randomUUID(), { listening: 1, reading: 1 }), listeningCorrect: -1 })), { name: 'ZodError' });
});

test('an admin reads the progress and XP of one learner; others cannot; the id must be a UUID (D114)', async () => {
  const { service, content } = progressHarness([2]);
  const admin = { id: '33333333-3333-4333-8333-333333333333', role: 'ADMIN' };
  await service.applyResult(message(LESSON_COMPLETED, { accountId: student.id, lessonId: content.lessons[0].id, completedAt: '2026-10-17T08:00:00.000Z' }));
  const summary = await service.getLearnerSummary(admin, student.id);
  assert.equal(summary.learnerId, student.id);
  assert.equal(summary.progress.completion.completedLessons, 1);
  assert.deepEqual([summary.xp.totalXp, summary.xp.rank], [0, null]);
  // A learner without anything yet still answers.
  assert.equal((await service.getLearnerSummary(admin, otherStudent.id)).progress.completion.completedLessons, 0);
  await assert.rejects(() => service.getLearnerSummary(student, otherStudent.id), { code: 26 });
  await assert.rejects(() => service.getLearnerSummary(manager, otherStudent.id), { code: 26 });
  await assert.rejects(() => service.getLearnerSummary(admin, 'not-a-uuid'), { name: 'ZodError' });
});

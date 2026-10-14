import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultScoreConversion,
  estimatedSectionScore,
  recommendedLevel,
} from '../src/mock/mock.rules.js';
import { scoreConversionSchema } from '../src/mock/mock.schemas.js';
import { admin, manager, otherStudent, student } from './helpers.js';
import { harness } from './mock-helpers.js';

const FULL = { kind: 'FULL' };
const mini = (partKey) => ({ kind: 'MINI', partKey });

test('the estimated score follows the conversion table', () => {
  const { listening, reading } = defaultScoreConversion();
  assert.equal(listening.length, 101);
  assert.deepEqual([listening[0], listening[100], reading[0], reading[100]], [5, 495, 5, 495]);
  assert.equal(scoreConversionSchema.safeParse({ listening, reading }).success, true);
  assert.equal(estimatedSectionScore(50, 100, listening), listening[50]);
  // A section with another number of questions is scaled by its share.
  assert.equal(estimatedSectionScore(3, 6, listening), listening[50]);
  assert.equal(estimatedSectionScore(0, 0, listening), 5);
  // Tables must have 101 non-decreasing multiples of 5 between 5 and 495.
  for (const bad of [listening.slice(1), listening.map((value, index) => (index === 50 ? 5 : value)), listening.map(() => 7), listening.map(() => 500)])
    assert.equal(scoreConversionSchema.safeParse({ listening: bad, reading }).success, false);
});

test('the suggested level comes from the latest full score, else from the placement', () => {
  assert.equal(recommendedLevel({ latestTotalScore: null, startUnit: null }), 1);
  assert.deepEqual([1, 2, 3, 5].map((startUnit) => recommendedLevel({ latestTotalScore: null, startUnit })), [1, 2, 3, 3]);
  assert.deepEqual([10, 445, 450, 695, 700, 990].map((latestTotalScore) => recommendedLevel({ latestTotalScore, startUnit: 3 })), [1, 1, 2, 2, 3, 3]);
});

test('only students take mock tests; only an admin edits the conversion table', async () => {
  const { service, tests } = await harness();
  for (const actor of [manager, admin]) {
    await assert.rejects(() => service.listMockTests(actor), { code: 26, status: 403 });
    await assert.rejects(() => service.startMockAttempt(actor, tests[0].id, FULL), { code: 26 });
  }
  for (const actor of [student, manager]) await assert.rejects(() => service.getScoreConversion(actor), { code: 26 });
  await assert.rejects(() => service.getMockTest(student, randomUUID()), { code: 57, status: 404 });
});

test('a full mock test is timed, shuffled, scored and estimated', async () => {
  const { service, tests, answers, advance, repository } = await harness({ startUnit: 2 });
  const [first] = tests;
  const list = await service.listMockTests(student);
  assert.equal(list.recommendedLevel, 2);
  assert.deepEqual(list.mockTests.map((item) => [item.title, item.recommended, item.attemptCount, item.bestPercent, item.latestTotalScore]), [['Level 1 test', false, 0, null, null], ['Level 2 test', true, 0, null, null]]);
  assert.deepEqual(await service.getMockAttempt(student, first.id, FULL), { status: 'NONE' });

  const started = await service.startMockAttempt(student, first.id, FULL);
  assert.equal(started.kind, 'FULL');
  assert.equal(started.expiresAt, '2026-10-11T10:00:00.000Z');
  assert.deepEqual(started.parts.flatMap((part) => part.questions.map((question) => question.number)), Array.from({ length: 13 }, (_, index) => index + 1));
  assert.equal(started.parts[5].groups.length, 1);
  assert.equal(started.parts[5].questions[0].groupId, started.parts[5].groups[0].id);
  // Parts 1-2 carry a recording per question, Parts 3-4 one per set.
  assert.equal(started.parts[0].questions[1].audioUrl, 'https://media.test/a.mp3');
  assert.equal(started.parts[0].audioUrl, null);
  assert.equal(started.parts[2].groups[0].audioUrl, 'https://media.test/a.mp3');
  assert.equal(started.parts[2].questions[0].audioUrl, null);
  for (const secret of ['isCorrect', 'Secret'])
    assert.equal(JSON.stringify(started).includes(secret), false, secret);
  // Starting again resumes; answers are kept.
  await service.saveMockAnswers(student, first.id, { ...FULL, answers: answers(first.id, 2) });
  assert.equal(Object.keys((await service.startMockAttempt(student, first.id, FULL)).answers).length, 13);
  assert.equal(repository.tables.attempts.length, 1);

  advance(30);
  const result = await service.submitMockAttempt(student, first.id, { ...FULL, answers: answers(first.id, 9) });
  const { listening, reading } = defaultScoreConversion();
  // 9 right: all 6 listening and 3 of 7 reading.
  assert.deepEqual({ ...result.attempt, submittedAt: null }, {
    attemptNumber: 1, correctCount: 9, totalCount: 13, scorePercent: 69,
    listeningCorrect: 6, listeningTotal: 6, readingCorrect: 3, readingTotal: 7,
    durationSeconds: 1800, submittedAt: null,
    estimated: { listeningScore: listening[100], readingScore: reading[43], totalScore: listening[100] + reading[43] },
    countsForXp: true,
  });
  assert.equal(result.parts[0].questions[0].transcript, 'Secret transcript');
  assert.equal(result.parts[3].groups[0].transcript, 'Secret transcript');
  assert.equal(result.parts[4].questions[0].explanation, 'Secret explanation');
  await assert.rejects(() => service.submitMockAttempt(student, first.id, { ...FULL, answers: {} }), { code: 58, status: 409 });

  // A retake counts for the history but not for XP.
  await service.startMockAttempt(student, first.id, FULL);
  const retake = await service.submitMockAttempt(student, first.id, { ...FULL, answers: answers(first.id, 13) });
  assert.equal(retake.attempt.attemptNumber, 2);
  assert.equal(retake.attempt.countsForXp, false);
  const detail = await service.getMockTest(student, first.id);
  assert.equal(detail.mockTest.questionCount, 13);
  assert.deepEqual(detail.full.attempts.map((attempt) => attempt.scorePercent), [69, 100]);
  assert.equal(detail.full.progression.trend, 'IMPROVED');
  assert.equal(detail.full.inProgress, false);
  assert.equal((await service.getMockReview(student, first.id, { ...FULL, attemptNumber: 1 })).attempt.scorePercent, 69);
  assert.equal((await service.getMockReview(student, first.id, FULL)).attempt.attemptNumber, 2);
  assert.deepEqual(await service.getMockReview(student, first.id, { ...FULL, attemptNumber: 9 }), { attempt: null, parts: [] });

  // The latest full score now drives the suggestion: 990 is level 3.
  const after = await service.listMockTests(student);
  assert.equal(after.recommendedLevel, 3);
  assert.deepEqual(after.mockTests.map((item) => [item.attemptCount, item.bestPercent, item.latestTotalScore]), [[2, 100, 990], [0, null, null]]);
  // Another learner is not affected.
  assert.equal((await service.listMockTests(otherStudent)).recommendedLevel, 1);
});

test('the full test clock is kept by the server', async () => {
  const { service, tests, answers, advance } = await harness();
  const second = tests[1];
  await service.startMockAttempt(student, second.id, FULL);
  await service.saveMockAnswers(student, second.id, { ...FULL, answers: answers(second.id, 4) });
  advance(61);
  // Too late: the saved answers are scored.
  await assert.rejects(() => service.saveMockAnswers(student, second.id, { ...FULL, answers: {} }), { code: 58 });
  const detail = await service.getMockTest(student, second.id);
  assert.deepEqual(detail.full.attempts.map((attempt) => [attempt.correctCount, attempt.durationSeconds]), [[4, 3600]]);
});

test('a mini test is one part, untimed, repeatable and without XP', async () => {
  const { service, tests, answers, advance } = await harness();
  const [first] = tests;
  await assert.rejects(() => service.submitMockAttempt(student, first.id, { ...mini('part5'), answers: {} }), { code: 58 });

  const started = await service.startMockAttempt(student, first.id, mini('part6'));
  assert.equal(started.expiresAt, null);
  assert.equal(started.partKey, 'part6');
  assert.deepEqual(started.parts.map((part) => part.key), ['part6']);
  assert.deepEqual(started.parts[0].questions.map((question) => question.number), [1, 2]);
  // It runs next to a full attempt and next to another part's mini test.
  await service.startMockAttempt(student, first.id, FULL);
  await service.startMockAttempt(student, first.id, mini('part1'));
  advance(90);
  // No time limit: still open long after a part would take.
  assert.equal((await service.getMockAttempt(student, first.id, mini('part6'))).status, 'IN_PROGRESS');

  const result = await service.submitMockAttempt(student, first.id, { ...mini('part6'), answers: answers(first.id, 1, ['part6']) });
  assert.deepEqual({ ...result.attempt, submittedAt: null, durationSeconds: null }, {
    attemptNumber: 1, correctCount: 1, totalCount: 2, scorePercent: 50,
    listeningCorrect: 0, listeningTotal: 0, readingCorrect: 1, readingTotal: 2,
    durationSeconds: null, submittedAt: null, estimated: null, countsForXp: false,
  });
  assert.deepEqual(result.parts.map((part) => part.key), ['part6']);
  assert.equal(result.parts[0].questions[0].options.some((option) => option.isCorrect), true);

  await service.startMockAttempt(student, first.id, mini('part6'));
  await service.submitMockAttempt(student, first.id, { ...mini('part6'), answers: answers(first.id, 2, ['part6']) });
  const detail = await service.getMockTest(student, first.id);
  const part6 = detail.parts.find((part) => part.key === 'part6');
  assert.equal(part6.questionCount, 2);
  assert.deepEqual(part6.mini.attempts.map((attempt) => attempt.scorePercent), [50, 100]);
  assert.equal(part6.mini.progression.trend, 'IMPROVED');
  // The other series are separate.
  assert.equal(detail.parts.find((part) => part.key === 'part1').mini.inProgress, true);
  assert.deepEqual(detail.parts.find((part) => part.key === 'part5').mini, { attempts: [], progression: null, inProgress: false });
  // Mini tests do not count as full attempts in the list.
  assert.equal((await service.listMockTests(student)).mockTests[0].attemptCount, 0);
});

test('an attempt finishes on the version it started, and the estimate is stored', async () => {
  const { service, tests, answers, content } = await harness();
  const [first] = tests;
  const original = content.paperOf(first.id);
  const started = await service.startMockAttempt(student, first.id, FULL);
  content.republish(first);
  assert.equal((await service.getMockAttempt(student, first.id, FULL)).parts[0].questions[0].id, started.parts[0].questions[0].id);
  const right = Object.fromEntries(Object.values(original.test).flatMap((part) => part.questions).map((question) => [question.id, question.options[0].id]));
  const result = await service.submitMockAttempt(student, first.id, { ...FULL, answers: right });
  assert.equal(result.attempt.correctCount, 13);

  // An admin changes the table: stored results keep their estimate.
  const { conversion, isDefault } = await service.getScoreConversion(admin);
  assert.equal(isDefault, true);
  const lower = { listening: conversion.listening.map(() => 5), reading: conversion.reading.map(() => 5) };
  assert.equal((await service.updateScoreConversion(admin, lower)).isDefault, false);
  assert.equal((await service.getMockReview(student, first.id, FULL)).attempt.estimated.totalScore, 990);
  await service.startMockAttempt(student, first.id, FULL);
  assert.equal((await service.submitMockAttempt(student, first.id, { ...FULL, answers: answers(first.id, 13) })).attempt.estimated.totalScore, 10);
});

test('an attempt left without submitting is removed, and the next one starts afresh (D82)', async () => {
  const { service, tests, answers, advance, repository } = await harness();
  const [first] = tests;
  await assert.rejects(() => service.discardMockAttempt(student, first.id, FULL), { code: 58, status: 409 });

  await service.startMockAttempt(student, first.id, mini('part5'));
  await service.startMockAttempt(student, first.id, FULL);
  await service.saveMockAnswers(student, first.id, { ...FULL, answers: answers(first.id, 5) });
  assert.deepEqual(await service.discardMockAttempt(student, first.id, FULL), { discarded: true });
  // Only the full attempt goes; the mini test of Part 5 stays in progress.
  assert.deepEqual(repository.tables.attempts.map((row) => [row.kind, row.status]), [['MINI', 'IN_PROGRESS']]);
  const detail = await service.getMockTest(student, first.id);
  assert.deepEqual([detail.full.attempts, detail.full.inProgress], [[], false]);
  const again = await service.startMockAttempt(student, first.id, FULL);
  assert.deepEqual([again.attemptNumber, again.answers], [1, {}]);

  // An attempt whose time ran out is scored instead.
  advance(200);
  await assert.rejects(() => service.discardMockAttempt(student, first.id, FULL), { code: 58 });
  assert.equal((await service.getMockTest(student, first.id)).full.attempts.length, 1);
});

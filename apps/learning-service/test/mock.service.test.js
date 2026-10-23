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
  assert.equal(estimatedSectionScore(3, 6, listening), listening[50]);
  assert.equal(estimatedSectionScore(0, 0, listening), 5);
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
  assert.equal(started.parts[0].questions[1].audioUrl, 'https://media.test/a.mp3');
  assert.equal(started.parts[0].audioUrl, null);
  assert.equal(started.parts[2].groups[0].audioUrl, 'https://media.test/a.mp3');
  assert.equal(started.parts[2].questions[0].audioUrl, null);
  for (const secret of ['isCorrect', 'Secret'])
    assert.equal(JSON.stringify(started).includes(secret), false, secret);
  await service.saveMockAnswers(student, first.id, { ...FULL, answers: answers(first.id, 2) });
  assert.equal(Object.keys((await service.startMockAttempt(student, first.id, FULL)).answers).length, 13);
  assert.equal(repository.tables.attempts.length, 1);

  advance(30);
  const result = await service.submitMockAttempt(student, first.id, { ...FULL, answers: answers(first.id, 9) });
  const { listening, reading } = defaultScoreConversion();
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

  const after = await service.listMockTests(student);
  assert.equal(after.recommendedLevel, 3);
  assert.deepEqual(after.mockTests.map((item) => [item.attemptCount, item.bestPercent, item.latestTotalScore]), [[2, 100, 990], [0, null, null]]);
  assert.equal((await service.listMockTests(otherStudent)).recommendedLevel, 1);
});

test('the full test clock is kept by the server', async () => {
  const { service, tests, answers, advance } = await harness();
  const second = tests[1];
  await service.startMockAttempt(student, second.id, FULL);
  await service.saveMockAnswers(student, second.id, { ...FULL, answers: answers(second.id, 4) });
  advance(61);
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
  await service.startMockAttempt(student, first.id, FULL);
  await service.startMockAttempt(student, first.id, mini('part1'));
  advance(90);
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
  assert.equal(detail.parts.find((part) => part.key === 'part1').mini.inProgress, true);
  assert.deepEqual(detail.parts.find((part) => part.key === 'part5').mini, { attempts: [], progression: null, inProgress: false });
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
  assert.deepEqual(repository.tables.attempts.map((row) => [row.kind, row.status]), [['MINI', 'IN_PROGRESS']]);
  const detail = await service.getMockTest(student, first.id);
  assert.deepEqual([detail.full.attempts, detail.full.inProgress], [[], false]);
  const again = await service.startMockAttempt(student, first.id, FULL);
  assert.deepEqual([again.attemptNumber, again.answers], [1, {}]);

  advance(200);
  await assert.rejects(() => service.discardMockAttempt(student, first.id, FULL), { code: 58 });
  assert.equal((await service.getMockTest(student, first.id)).full.attempts.length, 1);
});

test('mock stats (D162): only a Content Manager, nothing per question below the minimum of learners', async () => {
  const { service, repository, content, tests } = await harness();
  const mockTest = tests[0];
  const paper = content.paperOf(mockTest.id);
  const questions = Object.values(paper.test).flatMap((part) => part.questions);
  const [tricky] = questions;
  const completed = (accountId, fields = {}) => ({
    id: randomUUID(), accountId, mockTestId: mockTest.id, mockVersionId: paper.versionId, kind: 'FULL', partKey: '', attemptNumber: 1, status: 'COMPLETED',
    answers: Object.fromEntries(questions.map((question) => [question.id, question.options[question === tricky ? 1 : 0].id])),
    listeningScore: 300, readingScore: 200, ...fields,
  });
  await assert.rejects(() => service.getMockStats(student, mockTest.id), { code: 26 });
  await assert.rejects(() => service.getMockStats(admin, mockTest.id), { code: 26 });

  const learners = Array.from({ length: 5 }, () => randomUUID());
  repository.tables.attempts.push(...learners.slice(0, 4).map((id) => completed(id)));
  const few = await service.getMockStats(manager, mockTest.id);
  assert.deepEqual([few.learners, few.enoughLearners, few.averageScore, few.questions], [4, false, null, []]);

  repository.tables.attempts.push(completed(learners[4], { listeningScore: 400, readingScore: 300 }));
  repository.tables.attempts.push(completed(learners[0], { kind: 'MINI', partKey: 'part5', attemptNumber: 1, listeningScore: null, readingScore: null, answers: {} }));
  repository.tables.attempts.push({ ...completed(learners[1]), status: 'IN_PROGRESS' });
  const stats = await service.getMockStats(manager, mockTest.id);
  assert.deepEqual([stats.learners, stats.fullAttempts, stats.miniAttempts, stats.enoughLearners], [5, 5, 1, true]);
  assert.deepEqual(stats.averageScore, { total: 540, listening: 320, reading: 220 });
  const first = stats.questions.find((question) => question.id === tricky.id);
  assert.deepEqual([first.number, first.shown, first.correct, first.rate, first.flag], [1, 5, 0, 0, 'CHECK_KEY']);
  assert.deepEqual(first.options.map((option) => [option.letter, option.chosen, option.isCorrect]), [['A', 0, true], ['B', 5, false], ['C', 0, false], ['D', 0, false]]);
  const part5 = stats.questions.find((question) => question.partKey === 'part5');
  assert.deepEqual([part5.number, part5.shown, part5.skipped, part5.rate, part5.flag], [101, 6, 1, 83, null]);
  const part3 = stats.questions.filter((question) => question.partKey === 'part3').map((question) => question.number);
  assert.deepEqual(part3, [32, 33]);
  assert.equal(stats.questions.find((question) => question.partKey === 'part7').flag, 'EASY');
  assert.deepEqual(stats.parts.find((part) => part.key === 'part1'), { key: 'part1', number: 1, skill: 'LISTENING', questionCount: 2, shown: 10, correct: 5, rate: 50 });
});

test('study goal (D165): a student sets a target, sees the latest estimate and the weakest part of recent attempts', async () => {
  const { service, tests, answers, content } = await harness();
  await assert.rejects(() => service.getStudyGoal(manager), { code: 26 });
  const empty = await service.getStudyGoal(student);
  assert.deepEqual([empty.goal, empty.estimate, empty.weakestPart], [null, null, null]);
  await assert.rejects(() => service.saveStudyGoal(student, { targetScore: 650, examDate: '2020-01-01' }), { code: 30 });

  const id = tests[0].id;
  await service.startMockAttempt(student, id, FULL);
  const paper = content.paperOf(id);
  const right = answers(id, 13);
  for (const question of paper.test.part2.questions) right[question.id] = question.options[1].id;
  for (const question of paper.test.part5.questions) right[question.id] = question.options[1].id;
  await service.submitMockAttempt(student, id, { ...FULL, answers: right });

  const saved = await service.saveStudyGoal(student, { targetScore: 650, examDate: '2026-12-20' });
  assert.deepEqual(saved.goal, { targetScore: 650, examDate: '2026-12-20' });
  assert.equal(typeof saved.estimate.total, 'number');
  assert.equal(saved.estimate.mockTestId, id);
  assert.deepEqual(saved.history.map((point) => [point.total, point.mockTestId]), [[saved.estimate.total, id]]);
  assert.deepEqual(saved.parts.map((part) => [part.key, part.shown, part.rate]), [['part1', 2, 100], ['part2', 1, 0], ['part3', 2, 100], ['part4', 1, 100], ['part5', 2, 0], ['part6', 2, 100], ['part7', 3, 100]]);
  assert.equal(saved.weakestPart, null, 'a part needs at least 3 answered questions');
  await service.startMockAttempt(student, id, mini('part5'));
  await service.submitMockAttempt(student, id, { ...mini('part5'), answers: {} });
  assert.equal((await service.getStudyGoal(student)).weakestPart, 'part5');
  assert.deepEqual((await service.deleteStudyGoal(student)).goal, null);
});

test('mock mistakes (D167): wrong answers wait for review and leave after two right answers in a row', async () => {
  const { service, tests, content, advance } = await harness();
  const id = tests[0].id;
  const paper = content.paperOf(id);
  const questions = Object.values(paper.test).flatMap((part) => part.questions);
  const [first, second] = paper.test.part5.questions;
  await assert.rejects(() => service.getMockMistakes(manager), { code: 26 });
  assert.equal((await service.getMockMistakes(student)).total, 0);

  const allRight = Object.fromEntries(questions.map((question) => [question.id, question.options[0].id]));
  await service.startMockAttempt(student, id, FULL);
  await service.submitMockAttempt(student, id, { ...FULL, answers: { ...allRight, [first.id]: first.options[1].id, [second.id]: undefined } });
  const summary = await service.getMockMistakes(student);
  assert.deepEqual([summary.total, summary.parts.find((part) => part.key === 'part5').count], [2, 2]);

  const practice = await service.getMistakePractice(student, { partKey: 'part5' });
  assert.deepEqual(practice.questions.map((question) => [question.questionId, question.number, question.partNumber]), [[first.id, 101, 5], [second.id, 102, 5]]);
  assert.equal(JSON.stringify(practice).includes('isCorrect'), false);
  assert.equal(JSON.stringify(practice).includes('Secret explanation'), false);

  advance(1);
  const wrong = await service.answerMistake(student, { questionId: first.id, optionId: first.options[2].id });
  assert.deepEqual([wrong.correct, wrong.correctOptionId, wrong.explanation, wrong.streak, wrong.cleared], [false, first.options[0].id, 'Secret explanation', 0, false]);
  advance(1);
  assert.deepEqual((({ correct, streak, cleared }) => [correct, streak, cleared])(await service.answerMistake(student, { questionId: first.id, optionId: first.options[0].id })), [true, 1, false]);
  advance(1);
  const done = await service.answerMistake(student, { questionId: first.id, optionId: first.options[0].id });
  assert.deepEqual([done.cleared, done.remaining], [true, 1]);
  assert.equal((await service.getMockMistakes(student)).total, 1);
  await assert.rejects(() => service.answerMistake(student, { questionId: first.id, optionId: first.options[0].id }), { code: 57 });

  advance(1);
  await service.startMockAttempt(student, id, mini('part5'));
  await service.submitMockAttempt(student, id, { ...mini('part5'), answers: { [first.id]: first.options[0].id, [second.id]: second.options[0].id } });
  assert.equal((await service.getMockMistakes(student)).total, 1, 'one right answer in a test counts toward the two');
});

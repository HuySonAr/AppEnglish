import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningEventType, LearningQueue } from '@appenglish/learning-contracts';
import { LearningEvents } from '../src/events/learning-events.js';
import { LessonService } from '../src/lesson/lesson.service.js';
import { MockService } from '../src/mock/mock.service.js';
import { createEventRepository, createMemoryRepository, fakeTransport, student } from './helpers.js';
import { createCurriculum, createLessonRepository, placementWith, quizAnswers, testAnswers } from './lesson-helpers.js';
import { harness as mockHarness } from './mock-helpers.js';

const learner = { ...student, email: 'learner@appenglish.test' };
const at = new Date('2026-10-17T08:00:00Z');

function eventsHarness() {
  const repository = createEventRepository();
  const transport = fakeTransport();
  const events = new LearningEvents(repository, { transport, now: () => at });
  return { repository, transport, events };
}

test('an event is written to the outbox and relayed in order once the broker confirms it', async () => {
  assert.equal(LearningQueue.RESULTS, 'learning.results');
  const { repository, transport, events } = eventsHarness();
  transport.ready = false;
  await events.record('a', { n: 1 });
  await events.record('b', { n: 2 });
  assert.deepEqual(transport.sent, []);
  assert.deepEqual(repository.tables.events.map((row) => [row.type, row.publishedAt]), [['a', null], ['b', null]]);

  transport.ready = true;
  await events.flush();
  assert.deepEqual(
    transport.sent.map((message) => [message.type, message.payload, message.occurredAt]),
    [['a', { n: 1 }, at.toISOString()], ['b', { n: 2 }, at.toISOString()]],
  );
  assert.deepEqual(transport.sent.map((message) => message.id), repository.tables.events.map((row) => row.id));
  assert.equal(repository.tables.events.every((row) => row.publishedAt === at), true);
  await events.flush();
  assert.equal(transport.sent.length, 2);
});

test('an event the broker refuses stays pending and goes out on the next relay', async () => {
  const { repository, transport, events } = eventsHarness();
  transport.failing = true;
  await events.record('a', {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual([transport.sent.length, repository.tables.events[0].publishedAt], [0, null]);
  transport.failing = false;
  await events.flush();
  assert.deepEqual([transport.sent.length, repository.tables.events[0].publishedAt], [1, at]);
});

test('a failure to write the outbox is logged, not thrown at the learner', async () => {
  const { events } = eventsHarness();
  events.repository.addEvent = async () => {
    throw new Error('database away');
  };
  assert.equal(await events.record('a', {}), null);
});

test('a finished lesson test is reported; the lesson is reported completed once', async () => {
  const content = createCurriculum([2]);
  const repository = createLessonRepository();
  const { repository: outbox, events } = eventsHarness();
  const reported = () => outbox.tables.events.filter((row) => row.type !== LearningEventType.ACTIVITY_RECORDED);
  const activities = () => outbox.tables.events.filter((row) => row.type === LearningEventType.ACTIVITY_RECORDED).map((row) => row.payload.activity);
  const service = new LessonService(repository, await placementWith(learner.id, 1), content, { now: () => at, events });
  const [first] = content.lessons;
  const paper = content.paperOf(first.id);
  await service.markVocabularyStudied(learner, first.id);
  await service.submitVocabularyQuiz(learner, first.id, { kind: 'vocabulary', answers: quizAnswers(paper) });
  await service.submitFillIn(learner, first.id, { answers: paper.content.fillIn.answers });

  await service.startLessonTest(learner, first.id);
  await service.submitLessonTest(learner, first.id, { answers: testAnswers(paper, 18) });
  assert.deepEqual(reported().map((row) => row.type), [LearningEventType.LESSON_TEST_SUBMITTED]);
  const [failed] = reported();
  assert.deepEqual(activities(), ['lessonStep', 'lessonStep', 'lessonStep', 'lessonTest']);
  assert.deepEqual(failed.payload, {
    attemptId: repository.tables.attempts[0].id,
    accountId: learner.id,
    lessonId: first.id,
    lessonVersionId: paper.versionId,
    attemptNumber: 1,
    correctCount: 18,
    totalCount: 23,
    scorePercent: 78,
    listeningCorrect: 9,
    listeningTotal: 9,
    readingCorrect: 9,
    readingTotal: 14,
    passed: false,
    durationSeconds: 0,
    submittedAt: at.toISOString(),
  });

  for (const correct of [19, 23]) {
    await service.startLessonTest(learner, first.id);
    await service.submitLessonTest(learner, first.id, { answers: testAnswers(paper, correct) });
  }
  assert.deepEqual(
    reported().map((row) => row.type),
    [
      LearningEventType.LESSON_TEST_SUBMITTED,
      LearningEventType.LESSON_TEST_SUBMITTED,
      LearningEventType.LESSON_COMPLETED,
      LearningEventType.LESSON_TEST_SUBMITTED,
    ],
  );
  assert.deepEqual(reported()[2].payload, { accountId: learner.id, lessonId: first.id, completedAt: at.toISOString() });
  assert.deepEqual(
    reported()
      .filter((row) => row.type === LearningEventType.LESSON_TEST_SUBMITTED)
      .map((row) => [row.payload.attemptNumber, row.payload.passed]),
    [[1, false], [2, true], [3, true]],
  );
});

test('a full mock test is reported with its counts and estimate; a mini test is not', async () => {
  const { repository, content, tests, answers } = await mockHarness();
  const { repository: outbox, events } = eventsHarness();
  const reported = () => outbox.tables.events.filter((row) => row.type !== LearningEventType.ACTIVITY_RECORDED);
  const activities = () => outbox.tables.events.filter((row) => row.type === LearningEventType.ACTIVITY_RECORDED).map((row) => row.payload.activity);
  const service = new MockService(repository, createMemoryRepository(), content, { now: () => at, events });
  const [first] = tests;
  await service.startMockAttempt(student, first.id, { kind: 'MINI', partKey: 'part5' });
  await service.submitMockAttempt(student, first.id, { kind: 'MINI', partKey: 'part5', answers: answers(first.id, 2, ['part5']) });
  assert.deepEqual(reported(), []);
  assert.deepEqual(activities(), ['mockTest']);

  await service.startMockAttempt(student, first.id, { kind: 'FULL' });
  const result = await service.submitMockAttempt(student, first.id, { kind: 'FULL', answers: answers(first.id, 9) });
  assert.equal(reported().length, 1);
  assert.deepEqual(activities(), ['mockTest', 'mockTest']);
  const [event] = reported();
  assert.equal(event.type, LearningEventType.MOCK_SUBMITTED);
  const attempt = repository.tables.attempts.find((row) => row.kind === 'FULL');
  assert.deepEqual(event.payload, {
    attemptId: attempt.id,
    accountId: student.id,
    accountEmail: '',
    mockTestId: first.id,
    mockTestTitle: 'Level 1 test',
    mockVersionId: content.paperOf(first.id).versionId,
    kind: 'FULL',
    attemptNumber: 1,
    correctCount: 9,
    totalCount: 13,
    listeningCorrect: result.attempt.listeningCorrect,
    listeningTotal: result.attempt.listeningTotal,
    readingCorrect: result.attempt.readingCorrect,
    readingTotal: result.attempt.readingTotal,
    submittedAt: at.toISOString(),
    listeningScore: result.attempt.estimated.listeningScore,
    readingScore: result.attempt.estimated.readingScore,
  });
});

test('a finished round of word memory counts as a day of study (D154)', async () => {
  const { repository: outbox, events } = eventsHarness();
  const service = new LessonService(createLessonRepository(), await placementWith(learner.id, 1), createCurriculum([1]), { now: () => at, events });
  assert.deepEqual(await service.completeVocabularyPractice(learner), { recorded: true });
  assert.deepEqual(outbox.tables.events.map((row) => [row.type, row.payload]), [
    [LearningEventType.ACTIVITY_RECORDED, { accountId: learner.id, activity: 'wordMemory', occurredAt: at.toISOString() }],
  ]);
  await assert.rejects(() => service.completeVocabularyPractice({ ...learner, role: 'CONTENT_MANAGER' }), { code: 26 });
});


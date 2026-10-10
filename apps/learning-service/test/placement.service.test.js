import test from 'node:test';
import assert from 'node:assert/strict';
import { PlacementService, scorePlacement } from '../src/placement/placement.service.js';
import {
  admin,
  answersFor,
  createContentClient,
  createMemoryRepository,
  manager,
  otherStudent,
  placementPaper,
  student,
} from './helpers.js';

function harness(paper = placementPaper()) {
  const repository = createMemoryRepository();
  const content = createContentClient(paper);
  const clock = { now: new Date('2026-10-10T08:00:00Z') };
  const service = new PlacementService(repository, content, () => new Date(clock.now));
  const advance = (minutes) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60 * 1000);
  };
  return { repository, content, service, paper, advance };
}

test('scoring counts right answers in total and per skill', () => {
  const paper = placementPaper();
  assert.deepEqual(scorePlacement(paper.test, answersFor(paper, 23)), { totalCount: 23, correctCount: 23, listeningCorrect: 9, readingCorrect: 14 });
  assert.deepEqual(scorePlacement(paper.test, answersFor(paper, 10)), { totalCount: 23, correctCount: 10, listeningCorrect: 9, readingCorrect: 1 });
  // Unanswered questions, unknown questions and options of another question count as wrong.
  const first = paper.test.part1.questions[0];
  const second = paper.test.part2.questions[0];
  assert.equal(scorePlacement(paper.test, { [first.id]: second.options[0].id, unknown: 'x' }).correctCount, 0);
  assert.equal(scorePlacement(paper.test, {}).correctCount, 0);
});

test('only students take the placement test', async () => {
  const { service } = harness();
  for (const actor of [manager, admin]) {
    await assert.rejects(() => service.getPlacement(actor), { code: 26, status: 403 });
    await assert.rejects(() => service.startPlacement(actor), { code: 26 });
    await assert.rejects(() => service.skipPlacement(actor), { code: 26 });
    await assert.rejects(() => service.submitPlacement(actor, { answers: {} }), { code: 26 });
  }
});

test('a learner starts once, gets the paper without answers and resumes it', async () => {
  const { service, repository, paper, advance } = harness();
  assert.deepEqual(await service.getPlacement(student), { status: 'NOT_STARTED', available: true, durationMinutes: 25 });

  const started = await service.startPlacement(student);
  assert.equal(started.status, 'IN_PROGRESS');
  assert.equal(started.expiresAt, '2026-10-10T08:25:00.000Z');
  assert.equal(started.parts.length, 7);
  assert.deepEqual(started.parts.flatMap((part) => part.questions.map((question) => question.number)), Array.from({ length: 23 }, (_, index) => index + 1));
  assert.equal(started.parts[0].audioUrl, 'https://media.test/a.mp3');
  assert.equal(started.parts[0].questions[0].imageUrl, 'https://media.test/p.png');
  assert.deepEqual(Object.keys(started.parts[4].questions[0].options[0]), ['id', 'text']);
  const serialized = JSON.stringify(started);
  for (const secret of ['isCorrect', 'Secret', 'explanation', 'transcript'])
    assert.equal(serialized.includes(secret), false, secret);
  assert.equal(repository.tables.attempts[0].placementVersionId, paper.versionId);

  // Answers saved so far come back when the page is reloaded; the clock keeps running.
  const answers = answersFor(paper, 5);
  await service.savePlacementAnswers(student, { answers });
  advance(10);
  const resumed = await service.startPlacement(student);
  assert.equal(resumed.expiresAt, started.expiresAt);
  assert.equal(resumed.serverNow, '2026-10-10T08:10:00.000Z');
  assert.deepEqual(resumed.answers, answers);
  assert.deepEqual((await service.getPlacement(student)).answers, answers);
  assert.equal(repository.tables.attempts.length, 1);
});

test('submitting scores the attempt and decides the starting unit', async () => {
  for (const [correct, percent, startUnit] of [[13, 57, 1], [14, 61, 2], [18, 78, 2], [19, 83, 3], [23, 100, 3]]) {
    const { service, paper, repository } = harness();
    await service.startPlacement(student);
    const result = await service.submitPlacement(student, { answers: answersFor(paper, correct) });
    // The result shows the score and the starting unit only.
    assert.deepEqual(result, { status: 'COMPLETED', startUnit, correctCount: correct, totalCount: 23, scorePercent: percent });
    assert.deepEqual(await service.getPlacement(student), result);
    assert.equal(repository.tables.attempts[0].listeningCorrect + repository.tables.attempts[0].readingCorrect, correct);
  }
});

test('the placement test is taken only once', async () => {
  const { service, paper } = harness();
  await service.startPlacement(student);
  await service.submitPlacement(student, { answers: answersFor(paper, 23) });
  await assert.rejects(() => service.startPlacement(student), { code: 51, status: 409 });
  await assert.rejects(() => service.skipPlacement(student), { code: 51 });
  await assert.rejects(() => service.submitPlacement(student, { answers: {} }), { code: 52, status: 409 });
  await assert.rejects(() => service.savePlacementAnswers(student, { answers: {} }), { code: 52 });
  // Another learner is not affected.
  assert.equal((await service.getPlacement(otherStudent)).status, 'NOT_STARTED');
});

test('skipping starts at unit 1 and uses up the attempt', async () => {
  const { service } = harness();
  assert.deepEqual(await service.skipPlacement(student), { status: 'SKIPPED', startUnit: 1 });
  assert.deepEqual(await service.getPlacement(student), { status: 'SKIPPED', startUnit: 1 });
  await assert.rejects(() => service.startPlacement(student), { code: 51 });
  await assert.rejects(() => service.skipPlacement(student), { code: 51 });

  // Skipping is not possible once the test has started.
  const second = harness();
  await second.service.startPlacement(student);
  await assert.rejects(() => second.service.skipPlacement(student), { code: 51 });
});

test('the clock is kept by the server', async () => {
  // Submitting just after the deadline still counts.
  let context = harness();
  await context.service.startPlacement(student);
  context.advance(25.4);
  assert.equal((await context.service.submitPlacement(student, { answers: answersFor(context.paper, 23) })).correctCount, 23);

  // A late submit is scored with the answers saved in time.
  context = harness();
  await context.service.startPlacement(student);
  await context.service.savePlacementAnswers(student, { answers: answersFor(context.paper, 14) });
  context.advance(40);
  const late = await context.service.submitPlacement(student, { answers: answersFor(context.paper, 23) });
  assert.equal(late.correctCount, 14);
  assert.equal(late.startUnit, 2);

  // An attempt left open is completed when its time is over.
  context = harness();
  await context.service.startPlacement(student);
  await context.service.savePlacementAnswers(student, { answers: answersFor(context.paper, 19) });
  context.advance(26);
  await assert.rejects(() => context.service.savePlacementAnswers(student, { answers: {} }), { code: 52 });
  assert.deepEqual(await context.service.getPlacement(student), { status: 'COMPLETED', startUnit: 3, correctCount: 19, totalCount: 23, scorePercent: 83 });
});

test('without a published test nothing can start, and the start unit never exceeds the published units', async () => {
  let context = harness();
  context.content.publish(null);
  assert.equal((await context.service.getPlacement(student)).available, false);
  await assert.rejects(() => context.service.startPlacement(student), { code: 50, status: 409 });
  // Skipping stays possible.
  assert.equal((await context.service.skipPlacement(student)).startUnit, 1);

  context = harness(placementPaper({ publishedUnitCount: 2 }));
  await context.service.startPlacement(student);
  assert.equal((await context.service.submitPlacement(student, { answers: answersFor(context.paper, 23) })).startUnit, 2);
});

test('an attempt finishes on the version it started when the test is republished', async () => {
  const { service, content, paper } = harness();
  await service.startPlacement(student);
  const next = placementPaper({ versionNumber: 2 });
  content.publish(next);
  const resumed = await service.getPlacement(student);
  assert.equal(resumed.parts[0].questions[0].id, paper.test.part1.questions[0].id);
  assert.equal((await service.submitPlacement(student, { answers: answersFor(paper, 23) })).correctCount, 23);
  // A new learner gets the new version.
  assert.equal((await service.startPlacement(otherStudent)).parts[0].questions[0].id, next.test.part1.questions[0].id);
});

test('an admin changes the thresholds for later attempts', async () => {
  const { service, paper } = harness();
  for (const actor of [student, manager]) {
    await assert.rejects(() => service.getPlacementSettings(actor), { code: 26 });
    await assert.rejects(() => service.updatePlacementSettings(actor, { unit2Threshold: 50, unit3Threshold: 70 }), { code: 26 });
  }
  assert.deepEqual(await service.getPlacementSettings(admin), { settings: { unit2Threshold: 60, unit3Threshold: 80 }, durationMinutes: 25 });

  await service.startPlacement(student);
  assert.equal((await service.submitPlacement(student, { answers: answersFor(paper, 14) })).startUnit, 2);

  assert.deepEqual((await service.updatePlacementSettings(admin, { unit2Threshold: 70, unit3Threshold: 90 })).settings, { unit2Threshold: 70, unit3Threshold: 90 });
  await service.startPlacement(otherStudent);
  assert.equal((await service.submitPlacement(otherStudent, { answers: answersFor(paper, 14) })).startUnit, 1);
  // The earlier result keeps its starting unit.
  assert.equal((await service.getPlacement(student)).startUnit, 2);
});

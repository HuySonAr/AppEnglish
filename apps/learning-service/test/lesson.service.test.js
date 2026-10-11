import test from 'node:test';
import assert from 'node:assert/strict';
import { LessonService } from '../src/lesson/lesson.service.js';
import {
  lessonAccess,
  lessonSteps,
  shuffledOptionOrder,
  testParts,
  testProgression,
  vocabularyQuiz,
  wrongBlanks,
} from '../src/lesson/lesson.rules.js';
import { admin, manager, otherStudent, student } from './helpers.js';
import {
  createCurriculum,
  createLessonRepository,
  placementWith,
  quizAnswers,
  testAnswers,
} from './lesson-helpers.js';

const learner = { ...student, email: 'learner@appenglish.test' };
const rival = { ...otherStudent, email: 'rival@appenglish.test' };

async function harness({ shape = [2, 2], startUnit = 1 } = {}) {
  const content = createCurriculum(shape);
  const repository = createLessonRepository();
  const placement = await placementWith(learner.id, startUnit);
  await placement.createAttempt({ accountId: rival.id, status: 'SKIPPED', startUnit: 1, answers: {} });
  const clock = { now: new Date('2026-10-11T08:00:00Z') };
  const service = new LessonService(repository, placement, content, { now: () => new Date(clock.now) });
  const advance = (minutes) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60 * 1000);
  };
  // Goes through the steps before the test.
  const study = async (actor, lesson) => {
    const paper = content.paperOf(lesson.id);
    await service.markVocabularyStudied(actor, lesson.id);
    await service.submitVocabularyQuiz(actor, lesson.id, { kind: 'vocabulary', answers: quizAnswers(paper) });
    await service.submitFillIn(actor, lesson.id, { answers: paper.content.fillIn.answers });
  };
  const takeTest = async (actor, lesson, correct, minutes = 5) => {
    await service.startLessonTest(actor, lesson.id);
    advance(minutes);
    return service.submitLessonTest(actor, lesson.id, { answers: testAnswers(content.paperOf(lesson.id), correct) });
  };
  const states = async (actor = learner) =>
    (await service.getCurriculum(actor)).units.map((unit) => unit.lessons.map((lesson) => lesson.state));
  return { content, repository, service, advance, study, takeTest, states, lessons: content.lessons };
}

const ids = (count) => Array.from({ length: count }, (_, index) => `l${index + 1}`);
function curriculumOf(shape) {
  const all = ids(shape.reduce((sum, count) => sum + count, 0));
  let next = 0;
  return { units: shape.map((count) => ({ lessons: all.slice(next, (next += count)).map((id) => ({ id })) })) };
}
const statesOf = (shape, startUnit, completed = []) =>
  [...lessonAccess(curriculumOf(shape), startUnit, new Set(completed)).values()].map((entry) => entry.state[0]).join('');

test('lessons unlock in order from the starting unit', () => {
  // L locked, O open, C completed.
  assert.equal(statesOf([2, 2], 1), 'OLLL');
  assert.equal(statesOf([2, 2], 1, ['l1']), 'COLL');
  // The next unit opens after the last lesson of the unit before.
  assert.equal(statesOf([2, 2], 1, ['l1', 'l2']), 'CCOL');
  // Units before the starting unit are open freely; opening is not completing.
  assert.equal(statesOf([2, 2, 2], 2), 'OOOLLL');
  assert.equal(statesOf([2, 2, 2], 3), 'OOOOOL');
  assert.equal(statesOf([2, 2, 2], 2, ['l3']), 'OOCOLL');
  // Until the placement test is taken or skipped nothing is open.
  assert.equal(statesOf([2, 2], null), 'LLLL');
  assert.equal(statesOf([2, 2], null, ['l1']), 'CLLL');
});

test('the previous lesson is reviewed only when the learner studied it', () => {
  const review = (shape, startUnit, completed) =>
    [...lessonAccess(curriculumOf(shape), startUnit, new Set(completed)).values()].map((entry) => entry.reviewRequired);
  assert.deepEqual(review([2, 2], 1, ['l1', 'l2']), [false, true, true, false]);
  // The first lesson of the starting unit is exempt, even after free lessons.
  assert.deepEqual(review([2, 2], 2, ['l1', 'l2', 'l3']), [false, true, false, true]);
  // Free lessons whose predecessor was not studied need no review.
  assert.deepEqual(review([3], 1, []), [false, false, false]);
});

test('steps are done in order and a late review is not imposed', () => {
  const keys = (steps) => steps.map((step) => `${step.key}:${step.status[0]}`).join(' ');
  assert.equal(keys(lessonSteps({ reviewRequired: false }, {})), 'vocabulary:C quiz:L fillIn:L test:L');
  assert.equal(keys(lessonSteps({ reviewRequired: true }, {})), 'review:C vocabulary:L quiz:L fillIn:L test:L');
  assert.equal(keys(lessonSteps({ reviewRequired: true }, { reviewPassedAt: 1, vocabularyStudiedAt: 1 })), 'review:D vocabulary:D quiz:C fillIn:L test:L');
  // The learner had started before the review became required.
  assert.equal(keys(lessonSteps({ reviewRequired: true }, { vocabularyStudiedAt: 1, vocabularyQuizPassedAt: 1 })), 'vocabulary:D quiz:D fillIn:C test:L');
  assert.equal(keys(lessonSteps({ reviewRequired: false }, { vocabularyStudiedAt: 1, vocabularyQuizPassedAt: 1, fillInPassedAt: 1, completedAt: 1 })), 'vocabulary:D quiz:D fillIn:D test:D');
});

test('the vocabulary quiz asks every word once with four distinct meanings', () => {
  const vocabulary = ['a', 'b', 'c', 'd', 'e', 'f'].map((letter) => ({ id: letter, word: `word-${letter}`, partOfSpeech: 'noun', meaning: `meaning-${letter}` }));
  vocabulary.push({ id: 'g', word: 'word-g', partOfSpeech: 'verb', meaning: 'meaning-a' });
  const quiz = vocabularyQuiz(vocabulary);
  assert.deepEqual(quiz.map((question) => question.id).sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  for (const question of quiz) {
    const item = vocabulary.find((entry) => entry.id === question.id);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.ok(question.options.includes(item.meaning));
    assert.deepEqual(Object.keys(question), ['id', 'word', 'partOfSpeech', 'options']);
  }
  // The order changes between quizzes.
  const orders = new Set(Array.from({ length: 20 }, () => vocabularyQuiz(vocabulary).map((question) => question.id).join('')));
  assert.ok(orders.size > 1);
  // A short list gives fewer options.
  assert.equal(vocabularyQuiz(vocabulary.slice(0, 2))[0].options.length, 2);
});

test('blanks are compared without case and spaces', () => {
  assert.deepEqual(wrongBlanks(['Ticket', 'platform'], [' ticket ', 'PLATFORM']), []);
  assert.deepEqual(wrongBlanks(['ticket', 'platform', 'delay'], ['platform', 'platform']), [0, 2]);
});

test('options are shuffled in Parts 3-7 only and the paper hides the answers', async () => {
  const { content, lessons } = await harness();
  const paper = content.paperOf(lessons[0].id);
  const order = shuffledOptionOrder(paper.content.test, () => 0);
  const listening = paper.content.test.part1.questions[0];
  const reading = paper.content.test.part5.questions[0];
  assert.equal(order[listening.id], undefined);
  assert.equal(order[paper.content.test.part2.questions[0].id], undefined);
  assert.deepEqual([...order[reading.id]].sort(), reading.options.map((option) => option.id).sort());
  assert.notDeepEqual(order[reading.id], reading.options.map((option) => option.id));
  assert.equal(Object.keys(order).length, 20);

  const source = { test: paper.content.test, media: paper.media };
  const parts = testParts(source, { optionOrder: order });
  assert.deepEqual(parts[4].questions[0].options.map((option) => option.id), order[reading.id]);
  assert.deepEqual(parts[0].questions[0].options.map((option) => option.id), listening.options.map((option) => option.id));
  for (const secret of ['isCorrect', 'explanation', 'transcript', 'Secret'])
    assert.equal(JSON.stringify(parts).includes(secret), false, secret);

  // The review of a finished attempt shows everything.
  const review = testParts(source, { optionOrder: order, answers: { [reading.id]: reading.options[1].id } });
  assert.equal(review[0].transcript, 'Secret transcript');
  assert.equal(review[4].questions[0].explanation, 'Secret explanation');
  assert.equal(review[4].questions[0].chosenOptionId, reading.options[1].id);
  assert.equal(review[4].questions[0].options.filter((option) => option.isCorrect).length, 1);
  assert.equal(review[4].questions[1].chosenOptionId, null);
});

test('only students follow lessons, and only after the placement test', async () => {
  const { service, lessons } = await harness({ startUnit: null });
  for (const actor of [manager, admin]) {
    await assert.rejects(() => service.getCurriculum(actor), { code: 26, status: 403 });
    await assert.rejects(() => service.getLesson(actor, lessons[0].id), { code: 26 });
    await assert.rejects(() => service.getLessonRanking(actor, lessons[0].id), { code: 26 });
  }
  const curriculum = await service.getCurriculum(learner);
  assert.equal(curriculum.placementRequired, true);
  assert.equal(curriculum.startUnit, null);
  assert.deepEqual(curriculum.units.map((unit) => unit.lessons.map((lesson) => lesson.state)), [['LOCKED', 'LOCKED'], ['LOCKED', 'LOCKED']]);
  await assert.rejects(() => service.getLesson(learner, lessons[0].id), (error) => error.code === 54 && error.status === 409 && error.data.placementRequired === true);
});

test('a lesson is studied step by step', async () => {
  const { service, content, lessons, repository } = await harness();
  const [first, second] = lessons;
  const paper = content.paperOf(first.id);
  await assert.rejects(() => service.getLesson(learner, second.id), (error) => error.code === 54 && error.data.placementRequired === false);
  await assert.rejects(() => service.getLesson(learner, '00000000-0000-4000-8000-000000000000'), { code: 53, status: 404 });

  const view = await service.getLesson(learner, first.id);
  assert.deepEqual(view.lesson, { id: first.id, title: 'U1L1', number: 1, unitNumber: 1, unitTitle: 'Unit 1', state: 'OPEN' });
  assert.deepEqual(view.steps.map((step) => step.status), ['CURRENT', 'LOCKED', 'LOCKED', 'LOCKED']);
  assert.equal(view.review, null);
  assert.equal(view.vocabulary.length, 5);
  assert.deepEqual(view.fillIn, { passage: 'The ___ left from the ___.', blankCount: 2, wordBank: paper.content.vocabulary.map((item) => item.word) });
  assert.deepEqual(view.test, { durationMinutes: 25, passPercent: 80, attemptCount: 0, bestPercent: null });
  assert.equal(JSON.stringify(view).includes('isCorrect'), false);
  assert.equal('answers' in view.fillIn, false);

  // Each step waits for the one before it.
  await assert.rejects(() => service.getVocabularyQuiz(learner, first.id, { kind: 'vocabulary' }), (error) => error.code === 55 && error.data.step === 'vocabulary');
  await assert.rejects(() => service.submitFillIn(learner, first.id, { answers: [] }), (error) => error.code === 55 && error.data.step === 'vocabulary');
  await assert.rejects(() => service.startLessonTest(learner, first.id), (error) => error.code === 55 && error.data.step === 'vocabulary');
  assert.equal((await service.getLessonTest(learner, first.id)).status, 'LOCKED');
  // There is no review for the first lesson.
  await assert.rejects(() => service.getVocabularyQuiz(learner, first.id, { kind: 'review' }), { code: 53 });

  assert.deepEqual(await service.markVocabularyStudied(learner, first.id), { studied: true });
  const quiz = await service.getVocabularyQuiz(learner, first.id, { kind: 'vocabulary' });
  assert.equal(quiz.questions.length, 5);
  assert.equal(quiz.questions[0].options.length, 4);

  // Every word must be right; the wrong ones are named and tries are unlimited.
  const failed = await service.submitVocabularyQuiz(learner, first.id, { kind: 'vocabulary', answers: quizAnswers(paper, { wrong: 2 }) });
  assert.deepEqual(failed, { kind: 'vocabulary', passed: false, total: 5, wrongIds: paper.content.vocabulary.slice(0, 2).map((item) => item.id) });
  assert.equal((await service.submitVocabularyQuiz(learner, first.id, { kind: 'vocabulary', answers: {} })).wrongIds.length, 5);
  await assert.rejects(() => service.submitFillIn(learner, first.id, { answers: paper.content.fillIn.answers }), (error) => error.data.step === 'quiz');
  assert.equal((await service.submitVocabularyQuiz(learner, first.id, { kind: 'vocabulary', answers: quizAnswers(paper) })).passed, true);

  assert.deepEqual(await service.submitFillIn(learner, first.id, { answers: [paper.content.fillIn.answers[1], 'nothing'] }), { passed: false, total: 2, wrongBlanks: [0, 1] });
  await assert.rejects(() => service.startLessonTest(learner, first.id), (error) => error.data.step === 'fillIn');
  assert.deepEqual(await service.submitFillIn(learner, first.id, { answers: paper.content.fillIn.answers.map((answer) => answer.toUpperCase()) }), { passed: true, total: 2, wrongBlanks: [] });

  assert.deepEqual((await service.getLesson(learner, first.id)).steps.map((step) => step.status), ['DONE', 'DONE', 'DONE', 'CURRENT']);
  assert.equal((await service.getLessonTest(learner, first.id)).status, 'READY');
  assert.equal(repository.tables.progress.length, 1);
});

test('passing the lesson test with 80 percent completes the lesson and opens the next', async () => {
  const { service, lessons, study, takeTest, states, content } = await harness();
  const [first, second] = lessons;
  await study(learner, first);

  const started = await service.startLessonTest(learner, first.id);
  assert.equal(started.status, 'IN_PROGRESS');
  assert.equal(started.attemptNumber, 1);
  assert.equal(started.expiresAt, '2026-10-11T08:25:00.000Z');
  assert.equal(started.parts.flatMap((part) => part.questions).length, 23);
  assert.equal(JSON.stringify(started).includes('isCorrect'), false);
  // Starting again returns the attempt in progress with its saved answers.
  const answers = testAnswers(content.paperOf(first.id), 3);
  assert.deepEqual(await service.saveLessonTestAnswers(learner, first.id, { answers }), { saved: true });
  const resumed = await service.startLessonTest(learner, first.id);
  assert.equal(resumed.attemptNumber, 1);
  assert.deepEqual(resumed.answers, answers);
  assert.deepEqual(resumed.parts, started.parts);

  // 18 of 23 is 78%: not passed, the next lesson stays locked.
  const failed = await service.submitLessonTest(learner, first.id, { answers: testAnswers(content.paperOf(first.id), 18) });
  assert.deepEqual({ ...failed.attempt, submittedAt: null }, { attemptNumber: 1, correctCount: 18, totalCount: 23, scorePercent: 78, listeningCorrect: 9, listeningTotal: 9, readingCorrect: 9, readingTotal: 14, passed: false, durationSeconds: 0, submittedAt: null });
  // The result comes with every answer, explanation and transcript.
  assert.equal(failed.parts[0].transcript, 'Secret transcript');
  assert.equal(failed.parts[4].questions[0].explanation, 'Secret explanation');
  assert.equal(failed.parts.flatMap((part) => part.questions).every((question) => question.options.filter((option) => option.isCorrect).length === 1), true);
  assert.deepEqual(await states(), [['OPEN', 'LOCKED'], ['LOCKED', 'LOCKED']]);
  await assert.rejects(() => service.submitLessonTest(learner, first.id, { answers: {} }), { code: 56, status: 409 });
  await assert.rejects(() => service.saveLessonTestAnswers(learner, first.id, { answers: {} }), { code: 56 });

  // Retake: 19 of 23 is 83%.
  const passed = await takeTest(learner, first, 19);
  assert.equal(passed.attempt.attemptNumber, 2);
  assert.equal(passed.attempt.passed, true);
  assert.equal(passed.attempt.durationSeconds, 300);
  assert.deepEqual(await states(), [['COMPLETED', 'OPEN'], ['LOCKED', 'LOCKED']]);

  const test = await service.getLessonTest(learner, first.id);
  assert.equal(test.status, 'READY');
  assert.deepEqual(test.attempts.map((attempt) => attempt.scorePercent), [78, 83]);
  assert.deepEqual((await service.getLesson(learner, first.id)).test, { durationMinutes: 25, passPercent: 80, attemptCount: 2, bestPercent: 83 });
  const curriculum = await service.getCurriculum(learner);
  assert.equal(curriculum.units[0].lessons[0].bestPercent, 83);
  assert.equal(curriculum.units[0].lessons[1].bestPercent, null);
  // The review shows the latest attempt, or any earlier one by number.
  assert.equal((await service.getLessonTestReview(learner, first.id)).attempt.attemptNumber, 2);
  const earlier = await service.getLessonTestReview(learner, first.id, { attemptNumber: 1 });
  assert.equal(earlier.attempt.scorePercent, 78);
  assert.equal(earlier.parts.flatMap((part) => part.questions).filter((question) => question.options.find((option) => option.isCorrect).id === question.chosenOptionId).length, 18);
  assert.deepEqual(await service.getLessonTestReview(learner, first.id, { attemptNumber: 9 }), { attempt: null, parts: [] });
  // From the second attempt on the learner sees how the results develop.
  assert.deepEqual(test.progression, { trend: 'IMPROVED', changeFromPrevious: 1, changeFromFirst: 1, listeningChange: 0, readingChange: 1, bestCorrectCount: 19 });
  assert.deepEqual(await service.getLessonTestReview(learner, second.id), { attempt: null, parts: [] });

  // A completed lesson can be retaken; a worse score does not undo it.
  await takeTest(learner, first, 5);
  assert.deepEqual((await service.getLessonTest(learner, first.id)).progression, { trend: 'DECLINED', changeFromPrevious: -14, changeFromFirst: -13, listeningChange: -4, readingChange: -10, bestCorrectCount: 19 });
  assert.deepEqual(await states(), [['COMPLETED', 'OPEN'], ['LOCKED', 'LOCKED']]);
});

test('a new lesson starts with a review of the previous vocabulary', async () => {
  const { service, content, lessons, study, takeTest } = await harness();
  const [first, second] = lessons;
  await study(learner, first);
  await takeTest(learner, first, 23);

  const view = await service.getLesson(learner, second.id);
  assert.deepEqual(view.steps.map((step) => `${step.key}:${step.status}`), ['review:CURRENT', 'vocabulary:LOCKED', 'quiz:LOCKED', 'fillIn:LOCKED', 'test:LOCKED']);
  assert.deepEqual(view.review, { lessonId: first.id, lessonTitle: 'U1L1' });
  await assert.rejects(() => service.markVocabularyStudied(learner, second.id), (error) => error.code === 55 && error.data.step === 'review');

  // The review asks the words of the previous lesson.
  const previous = content.paperOf(first.id);
  const quiz = await service.getVocabularyQuiz(learner, second.id, { kind: 'review' });
  assert.deepEqual(quiz.questions.map((question) => question.id).sort(), previous.content.vocabulary.map((item) => item.id).sort());
  assert.equal((await service.submitVocabularyQuiz(learner, second.id, { kind: 'review', answers: quizAnswers(previous, { wrong: 1 }) })).passed, false);
  await assert.rejects(() => service.markVocabularyStudied(learner, second.id), { code: 55 });
  assert.equal((await service.submitVocabularyQuiz(learner, second.id, { kind: 'review', answers: quizAnswers(previous) })).passed, true);
  assert.deepEqual((await service.getLesson(learner, second.id)).steps.map((step) => step.status), ['DONE', 'CURRENT', 'LOCKED', 'LOCKED', 'LOCKED']);
  await service.markVocabularyStudied(learner, second.id);
});

test('lessons before the starting unit are open but not completed', async () => {
  const { service, lessons, states, study, takeTest } = await harness({ shape: [2, 2, 1], startUnit: 2 });
  assert.equal((await service.getCurriculum(learner)).startUnit, 2);
  assert.deepEqual(await states(), [['OPEN', 'OPEN'], ['OPEN', 'LOCKED'], ['LOCKED']]);
  // The first lesson of the starting unit has no review.
  assert.equal((await service.getLesson(learner, lessons[2].id)).review, null);
  // A free lesson whose predecessor was not studied has no review either.
  assert.equal((await service.getLesson(learner, lessons[1].id)).review, null);
  await study(learner, lessons[2]);
  await takeTest(learner, lessons[2], 23);
  assert.deepEqual(await states(), [['OPEN', 'OPEN'], ['COMPLETED', 'OPEN'], ['LOCKED']]);
});

test('the lesson test clock is kept by the server', async () => {
  // A submit just after the deadline counts; the time counted stops at the limit.
  let context = await harness();
  let [first] = context.lessons;
  await context.study(learner, first);
  let result = await context.takeTest(learner, first, 23, 25.4);
  assert.equal(result.attempt.correctCount, 23);
  assert.equal(result.attempt.durationSeconds, 1500);

  // A late submit is scored with the answers saved in time.
  context = await harness();
  [first] = context.lessons;
  await context.study(learner, first);
  await context.service.startLessonTest(learner, first.id);
  await context.service.saveLessonTestAnswers(learner, first.id, { answers: testAnswers(context.content.paperOf(first.id), 10) });
  context.advance(40);
  result = await context.service.submitLessonTest(learner, first.id, { answers: testAnswers(context.content.paperOf(first.id), 23) });
  assert.equal(result.attempt.correctCount, 10);

  // An attempt left open is finished when its time is over.
  context = await harness();
  [first] = context.lessons;
  await context.study(learner, first);
  await context.service.startLessonTest(learner, first.id);
  await context.service.saveLessonTestAnswers(learner, first.id, { answers: testAnswers(context.content.paperOf(first.id), 20) });
  context.advance(26);
  await assert.rejects(() => context.service.saveLessonTestAnswers(learner, first.id, { answers: {} }), { code: 56 });
  const view = await context.service.getLessonTest(learner, first.id);
  assert.equal(view.status, 'READY');
  assert.deepEqual(view.attempts.map((attempt) => [attempt.correctCount, attempt.passed]), [[20, true]]);
  assert.deepEqual(await context.states(), [['COMPLETED', 'OPEN'], ['LOCKED', 'LOCKED']]);
});

test('an attempt finishes on the lesson version it started', async () => {
  const { service, content, lessons, study } = await harness();
  const [first] = lessons;
  await study(learner, first);
  const original = content.paperOf(first.id);
  const started = await service.startLessonTest(learner, first.id);
  content.republish(first.id);
  assert.equal((await service.getLessonTest(learner, first.id)).parts[0].questions[0].id, started.parts[0].questions[0].id);
  const result = await service.submitLessonTest(learner, first.id, { answers: testAnswers(original, 23) });
  assert.equal(result.attempt.correctCount, 23);
  // The next attempt uses the new version; the steps stay done.
  const next = await service.startLessonTest(learner, first.id);
  assert.equal(next.attemptNumber, 2);
  assert.notEqual(next.parts[0].questions[0].id, started.parts[0].questions[0].id);
});

test('the lesson ranking uses first attempts: score, then time, then earlier submit', async () => {
  const { service, lessons, study, takeTest } = await harness();
  const [first] = lessons;
  const third = { id: '55555555-5555-4555-8555-555555555555', role: 'STUDENT', email: 'third@appenglish.test' };
  assert.deepEqual(await service.getLessonRanking(learner, first.id), { total: 0, entries: [], me: null });
  await assert.rejects(() => service.getLessonRanking(learner, '00000000-0000-4000-8000-000000000000'), { code: 53 });

  await study(learner, first);
  await takeTest(learner, first, 20, 10);
  // A better retake does not change the ranking.
  await takeTest(learner, first, 23, 1);
  await study(rival, first);
  await takeTest(rival, first, 20, 6);

  const ranking = await service.getLessonRanking(learner, first.id);
  assert.equal(ranking.total, 2);
  assert.deepEqual(ranking.entries.map((entry) => [entry.rank, entry.email, entry.scorePercent, entry.durationSeconds, entry.isMe]), [
    [1, 'rival@appenglish.test', 87, 360, false],
    [2, 'learner@appenglish.test', 87, 600, true],
  ]);
  assert.equal(ranking.me.rank, 2);
  // Every student can see it, also one who has not taken the test.
  const seenByOther = await service.getLessonRanking(third, first.id);
  assert.equal(seenByOther.total, 2);
  assert.equal(seenByOther.me, null);
  assert.equal(seenByOther.entries.some((entry) => entry.isMe), false);
});

test('progression compares the latest attempt with the previous and the first', () => {
  const attempt = (correctCount, listeningCorrect) => ({ correctCount, listeningCorrect, readingCorrect: correctCount - listeningCorrect });
  assert.equal(testProgression([]), null);
  assert.equal(testProgression([attempt(10, 4)]), null);
  assert.deepEqual(testProgression([attempt(10, 4), attempt(10, 6)]), { trend: 'UNCHANGED', changeFromPrevious: 0, changeFromFirst: 0, listeningChange: 2, readingChange: -2, bestCorrectCount: 10 });
  assert.deepEqual(testProgression([attempt(10, 4), attempt(20, 8), attempt(15, 9)]), { trend: 'DECLINED', changeFromPrevious: -5, changeFromFirst: 5, listeningChange: 1, readingChange: -6, bestCorrectCount: 20 });
});


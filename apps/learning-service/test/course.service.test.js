import test from 'node:test';
import assert from 'node:assert/strict';
import { courseMap } from '../src/course/course.rules.js';
import { manager, student } from './helpers.js';
import { completeQuestion, courseHarness, focusOn, rightAnswers, testAnswers } from './course-helpers.js';

const states = (level) => [
  level.state,
  ...level.units.map((unit) => [...unit.lessons.map((lesson) => lesson.state), unit.check.state]),
  level.levelTest?.state ?? null,
];

test('a learner starts at A1: lessons open one after the other, the level test at once', async () => {
  const { service, paper } = courseHarness();
  await assert.rejects(() => service.getCourse(manager), { code: 26, status: 403 });
  const course = await service.getCourse(student);
  assert.deepEqual(course.passPercent, { lesson: 70, unitCheck: 75, levelTest: 70, placementLevel: 60 });
  assert.equal(course.currentLevel, 'A1');
  assert.deepEqual(states(course.levels[0]), ['CURRENT', ['OPEN', 'LOCKED', 'LOCKED'], ['LOCKED', 'LOCKED'], 'OPEN']);
  assert.deepEqual(states(course.levels[1]), ['LOCKED', ['LOCKED', 'LOCKED'], null]);
  assert.deepEqual(course.next, {
    type: 'lesson',
    level: 'A1',
    unitId: paper.item.id,
    lessonId: paper.content.lessons[0].id,
    title: 'Ordering',
    unitTitle: 'Shopping',
  });
  const [unit] = course.levels[0].units;
  assert.deepEqual([unit.title, unit.check.questionCount, unit.lessons[0].bestScore, unit.lessons[0].attemptCount], ['Shopping', 4, null, 0]);
});

test('a lesson opens without its answers; a locked one is refused', async () => {
  const { service, unit, paper, segments, work } = courseHarness();
  const [first, second] = paper.content.lessons;
  const lesson = await service.getLesson(student, unit.id, { lessonId: first.id });
  assert.deepEqual(lesson.lesson, { id: first.id, title: 'Ordering', number: 1, count: 2 });
  assert.deepEqual([lesson.versionId, lesson.audioUrl, lesson.passPercent], [paper.versionId, 'https://media.test/cafe.mp3', 70]);
  assert.deepEqual(
    lesson.keywords.map((keyword) => [keyword.word, keyword.meaning]),
    [['large', 'lớn']],
  );
  // Sentences come in the order of the recording, with their place in it.
  assert.deepEqual(
    lesson.closeSegments.map((segment) => [segment.id, segment.start, segment.end]),
    [
      [segments[1].id, 2, 4],
      [segments[3].id, 6, 8],
    ],
  );
  const text = JSON.stringify(lesson);
  assert.equal(text.includes('isCorrect') || text.includes('Because') || text.includes('coffee please'), false);
  await assert.rejects(() => service.getLesson(student, unit.id, { lessonId: second.id }), { code: 61, status: 409 });
  await assert.rejects(() => service.getLesson(student, work.item.id, { lessonId: work.content.lessons[0].id }), { code: 61 });
  await assert.rejects(() => service.getLesson(student, unit.id, { lessonId: '99999999-9999-4999-8999-999999999999' }), { code: 60, status: 404 });
  await assert.rejects(() => service.getLesson(student, '99999999-9999-4999-8999-999999999999', { lessonId: first.id }), { code: 60 });
});

test('each step is checked as the learner goes, and nothing is kept', async () => {
  const { service, repository, unit, paper, segments } = courseHarness();
  const lesson = paper.content.lessons[0];
  const wrong = lesson.gist.options.find((option) => !option.isCorrect).id;
  const gist = await service.checkStep(student, unit.id, { lessonId: lesson.id, step: 'gist', answers: { [lesson.gist.id]: wrong } });
  assert.deepEqual([gist.questions[0].correct, gist.questions[0].chosenOptionId, gist.questions[0].explanation], [false, wrong, 'Because: In a café.']);

  const detail = await service.checkStep(student, unit.id, { lessonId: lesson.id, step: 'detail', answers: rightAnswers(lesson, segments) });
  assert.deepEqual(
    detail.questions.map((question) => question.correct),
    [true, true],
  );

  const close = await service.checkStep(student, unit.id, {
    lessonId: lesson.id,
    step: 'close',
    segmentId: segments[1].id,
    answers: { [segments[1].id]: 'yes a tea please' },
  });
  assert.deepEqual([close.sentence.text, close.sentence.accuracy], ['Yes, a coffee please.', 75]);
  // Only a sentence chosen for writing down is checked.
  await assert.rejects(() => service.checkStep(student, unit.id, { lessonId: lesson.id, step: 'close', segmentId: segments[0].id, answers: {} }), { code: 30 });
  // A version the learner did not open is refused.
  await assert.rejects(
    () => service.checkStep(student, unit.id, { lessonId: lesson.id, versionId: '99999999-9999-4999-8999-999999999999', step: 'gist', answers: {} }),
    { code: 60 },
  );
  assert.equal(repository.tables.results.length, 0);
});

test('a completed sentence and the Focus on passage count one point each by their blanks (D109)', async () => {
  const { service, unit, paper, segments } = courseHarness();
  const [lesson] = paper.content.lessons;
  lesson.detail.push(completeQuestion('Small or ___?', ['large']));
  lesson.focus = focusOn();
  const opened = await service.getLesson(student, unit.id, { lessonId: lesson.id });
  assert.deepEqual(opened.detail[2], { id: lesson.detail[2].id, kind: 'complete', skill: 'detail', prompt: 'Small or ___?', blankCount: 1, options: [] });
  assert.deepEqual(opened.focus, {
    title: 'Saying hello',
    passage: "A: How's it ___?\nB: Not too ___, thanks.",
    blankCount: 2,
    words: ['bad', 'going', 'well'],
  });
  const checked = await service.checkStep(student, unit.id, { lessonId: lesson.id, step: 'focus', answers: { 'focus:0': 'going', 'focus:1': 'well' } });
  assert.deepEqual(
    checked.focus.blanks.map((blank) => [blank.typed, blank.correct]),
    [
      ['going', true],
      ['well', false],
    ],
  );
  assert.equal(checked.focus.accuracy, 50);
  // Gist right, details right and right ('Large!' matches 'large'), focus 1 of 2,
  // both sentences right: (1 + 1 + 1 + 1 + 0.5 + 1 + 1) / 7 = 93%.
  const answers = { ...rightAnswers(lesson, segments), [`${lesson.detail[2].id}:0`]: 'Large!', 'focus:1': 'well' };
  const done = await service.complete(student, unit.id, { lessonId: lesson.id, answers });
  assert.deepEqual([done.score, done.passed, done.questions[3].accuracy, done.focus.accuracy], [93, true, 100, 50]);
  assert.deepEqual(done.questions[3].blanks, [{ index: 0, expected: 'large', typed: 'Large!', correct: true }]);
  // The next lesson, now open, has no Focus on step to check.
  const noFocus = paper.content.lessons[1];
  await assert.rejects(() => service.checkStep(student, unit.id, { lessonId: noFocus.id, step: 'focus', answers: {} }), { code: 30 });
});

test('finishing scores the whole lesson, keeps the best and the first pass, and opens the next', async () => {
  const { service, unit, paper, segments } = courseHarness();
  const [lesson, next] = paper.content.lessons;
  const answers = rightAnswers(lesson, segments);

  // Gist wrong, both details right, sentences 75% and 100%:
  // (0 + 1 + 1 + 0.75 + 1) / 5 = 75%, passed.
  answers[lesson.gist.id] = lesson.gist.options.find((option) => !option.isCorrect).id;
  answers[segments[1].id] = 'yes a tea please';
  const first = await service.complete(student, unit.id, { lessonId: lesson.id, versionId: paper.versionId, answers });
  assert.deepEqual([first.score, first.passed, first.bestScore, first.attemptCount], [75, true, 75, 1]);
  assert.deepEqual([first.next.type, first.next.lessonId], ['lesson', next.id]);
  assert.deepEqual(
    first.questions.map((question) => question.correct),
    [false, true, true],
  );
  assert.deepEqual(
    first.sentences.map((sentence) => sentence.accuracy),
    [75, 100],
  );
  assert.deepEqual(
    first.transcript.map((segment) => segment.writtenDown),
    [false, true, false, true],
  );

  // Nothing answered scores 0 and fails, but the best score and the pass stay.
  const empty = await service.complete(student, unit.id, { lessonId: lesson.id, answers: {} });
  assert.deepEqual([empty.score, empty.passed, empty.lessonPassed, empty.bestScore, empty.lastScore, empty.attemptCount], [0, false, true, 75, 0, 2]);
  const shown = (await service.getCourse(student)).levels[0].units[0].lessons[0];
  assert.deepEqual([shown.bestScore, shown.passed, shown.attemptCount, shown.state], [75, true, 2, 'PASSED']);

  // 3 of 5 points is 60%: below 70, not passed; it stays the next lesson.
  const low = rightAnswers(next, segments);
  for (const question of next.detail) low[question.id] = '';
  const failed = await service.complete(student, unit.id, { lessonId: next.id, answers: low });
  assert.deepEqual([failed.score, failed.passed, failed.next.lessonId], [60, false, next.id]);
});

test('the unit check opens after every lesson of the unit and opens the next unit', async () => {
  const { service, unit, paper, segments, travel } = courseHarness();
  await assert.rejects(() => service.getTest(student, unit.id), { code: 61 });
  for (const lesson of paper.content.lessons) await service.complete(student, unit.id, { lessonId: lesson.id, answers: rightAnswers(lesson, segments) });
  assert.deepEqual((await service.getCourse(student)).next, { type: 'unit_check', level: 'A1', itemId: unit.id, title: 'Shopping', unitTitle: 'Shopping' });

  const check = await service.getTest(student, unit.id);
  assert.deepEqual(
    [check.test.kind, check.test.title, check.passPercent, check.sections[0].questions.length, check.sections[0].audioUrl],
    ['unit_check', 'Shopping', 75, 4, 'https://media.test/cafe.mp3'],
  );
  assert.equal(JSON.stringify(check).includes('isCorrect') || JSON.stringify(check).includes('Because'), false);

  // 2 of 4 is 50%, then 3 of 4 is 75%: passed.
  const failed = await service.submitTest(student, unit.id, { answers: testAnswers(paper, 2) });
  assert.deepEqual([failed.score, failed.passed, failed.rightCount, failed.questionCount, failed.levelUp], [50, false, 2, 4, null]);
  await assert.rejects(() => service.getLesson(student, travel.item.id, { lessonId: travel.content.lessons[0].id }), { code: 61 });
  const passed = await service.submitTest(student, unit.id, { versionId: paper.versionId, answers: testAnswers(paper, 3) });
  assert.deepEqual([passed.score, passed.passed, passed.bestScore, passed.attemptCount], [75, true, 75, 2]);
  assert.equal(passed.sections[0].transcript[1].text, 'Yes, a coffee please.');
  assert.equal(passed.sections[0].questions[3].correct, false);
  assert.deepEqual([passed.next.type, passed.next.lessonId], ['lesson', travel.content.lessons[0].id]);
  assert.equal((await service.getLesson(student, travel.item.id, { lessonId: travel.content.lessons[0].id })).lesson.title, 'Airport');
});

test('passing the level test, even early, moves the learner up', async () => {
  const { service, levelTest, work, paper } = courseHarness();
  const test1 = await service.getTest(student, levelTest.item.id);
  assert.deepEqual([test1.test.kind, test1.test.nextLevel, test1.passPercent], ['level_test', 'A2', 70]);
  // 2 of 4 is 50%: not passed.
  assert.equal((await service.submitTest(student, levelTest.item.id, { answers: testAnswers(levelTest, 2) })).levelUp, null);
  const up = await service.submitTest(student, levelTest.item.id, { answers: testAnswers(levelTest, 3) });
  assert.deepEqual([up.score, up.passed, up.levelUp], [75, true, { from: 'A1', to: 'A2' }]);
  assert.deepEqual([up.next.type, up.next.lessonId], ['lesson', work.content.lessons[0].id]);

  // A1 is done: everything open for review; A2 is the level now.
  const course = await service.getCourse(student);
  assert.equal(course.currentLevel, 'A2');
  assert.deepEqual(states(course.levels[0]), ['DONE', ['OPEN', 'OPEN', 'OPEN'], ['OPEN', 'OPEN'], 'PASSED']);
  assert.deepEqual(states(course.levels[1]), ['CURRENT', ['OPEN', 'LOCKED'], null]);
  assert.equal((await service.getLesson(student, paper.item.id, { lessonId: paper.content.lessons[1].id })).lesson.title, 'Paying');
  // Taking it again changes nothing.
  assert.equal((await service.submitTest(student, levelTest.item.id, { answers: {} })).levelUp, null);
});

test('the course map: a starting level, and every level passed', () => {
  const level = (name, testId) => ({ level: name, units: [], levelTest: testId ? { id: testId, title: name } : null });
  const course = { levels: [level('A1', 't1'), level('A2', 't2')] };
  const fromA2 = courseMap(course, { lessonPassed: new Set(), testPassed: new Set(), startLevel: 'A2' });
  assert.deepEqual([fromA2.currentLevel, fromA2.levels.map((item) => item.state), fromA2.next.itemId], ['A2', ['DONE', 'CURRENT'], 't2']);
  const finished = courseMap(course, { lessonPassed: new Set(), testPassed: new Set(['t1', 't2']) });
  assert.deepEqual([finished.currentLevel, finished.next], [null, null]);
});

// Option ids of the placement: per level, how many of its 3 questions are right.
function placementAnswers(placementPaper, rightByLevel) {
  const answers = {};
  for (const section of placementPaper.content.sections)
    section.questions.forEach((question, index) => {
      answers[question.id] = question.options.find((item) => item.isCorrect === index < rightByLevel[section.level]).id;
    });
  return answers;
}

test('the listening placement sets the level the learner starts at, once', async () => {
  const { service, placementPaper, publishPlacement } = courseHarness();
  // Not published: nothing to take, the learner starts at A1.
  assert.deepEqual((await service.getCourse(student)).placement, { status: 'NOT_STARTED', available: false, startLevel: null });
  await assert.rejects(() => service.getPlacement(student), { code: 60, status: 404 });
  publishPlacement();
  assert.equal((await service.getCourse(student)).placement.available, true);

  const paper = await service.getPlacement(student);
  assert.deepEqual([paper.status, paper.sections.length, paper.sections[0].questions.length, paper.levelPassPercent], ['NOT_STARTED', 5, 3, 60]);
  // Neither the answers nor the level of each recording are shown.
  const text = JSON.stringify(paper);
  assert.equal(text.includes('isCorrect') || text.includes('"level"') || text.includes('Because'), false);

  // A1 3/3, A2 2/3 (67%, known), B1 1/3: the learner starts at B1.
  const result = await service.submitPlacement(student, {
    versionId: paper.versionId,
    answers: placementAnswers(placementPaper, { A1: 3, A2: 2, B1: 1, B2: 3, C1: 3 }),
  });
  assert.deepEqual([result.startLevel, result.currentLevel], ['B1', 'B1']);
  assert.deepEqual(
    result.levelScores.map((entry) => `${entry.level} ${entry.right}/${entry.total}`),
    ['A1 3/3', 'A2 2/3', 'B1 1/3', 'B2 3/3', 'C1 3/3'],
  );
  assert.equal(result.sections[2].level, 'B1');
  assert.equal(result.next, null);

  // A1 and A2 are done (open for review), B1 is the level now.
  const course = await service.getCourse(student);
  assert.deepEqual([course.currentLevel, course.levels.map((level) => level.state)], ['B1', ['DONE', 'DONE', 'CURRENT', 'LOCKED', 'LOCKED']]);
  assert.deepEqual(course.placement, { status: 'COMPLETED', available: true, startLevel: 'B1' });
  assert.deepEqual((await service.getPlacement(student)).startLevel, 'B1');
  await assert.rejects(() => service.submitPlacement(student, { answers: {} }), { code: 62, status: 409 });
  await assert.rejects(() => service.skipPlacement(student), { code: 62 });
});

test('skipping the placement starts at A1; every level known starts at C1', async () => {
  const { service, placementPaper, publishPlacement } = courseHarness();
  publishPlacement();
  assert.deepEqual(await service.skipPlacement(student), { status: 'SKIPPED', startLevel: 'A1' });
  assert.equal((await service.getCourse(student)).currentLevel, 'A1');
  const other = { ...student, id: '55555555-5555-4555-8555-555555555555' };
  const all = await service.submitPlacement(other, { answers: placementAnswers(placementPaper, { A1: 3, A2: 3, B1: 2, B2: 2, C1: 2 }) });
  assert.equal(all.startLevel, 'C1');
  await assert.rejects(() => service.skipPlacement(manager), { code: 26 });
});

test('sentences written wrong go to the mistakes notebook until written right', async () => {
  const { service, unit, paper, segments } = courseHarness();
  const [lesson] = paper.content.lessons;
  const answers = rightAnswers(lesson, segments);
  answers[segments[1].id] = 'yes a tea please';
  await service.complete(student, unit.id, { lessonId: lesson.id, answers });

  let notebook = await service.listMistakes(student);
  assert.equal(notebook.mistakes.length, 1);
  const [mistake] = notebook.mistakes;
  assert.deepEqual([mistake.level, mistake.unitTitle, mistake.lessonTitle, mistake.speaker, mistake.timesMissed], ['A1', 'Shopping', 'Ordering', 'Woman', 1]);
  assert.deepEqual(mistake.missedWords, [{ text: 'coffee', typed: 'tea' }]);
  assert.deepEqual([mistake.audioUrl, mistake.start, mistake.end], ['https://media.test/cafe.mp3', 2, 4]);
  // The sentence itself is not shown: it is written again.
  assert.equal(JSON.stringify(notebook).includes('coffee please'), false);
  assert.deepEqual(notebook.mostMissedWords, [{ word: 'coffee', count: 1 }]);

  // Wrong again in the lesson, then in the notebook: it stays and counts.
  await service.complete(student, unit.id, { lessonId: lesson.id, answers: { ...answers, [segments[1].id]: 'yes coffee' } });
  const again = await service.checkMistake(student, mistake.id, { text: 'yes a coffee' });
  assert.deepEqual([again.fixed, again.sentence.accuracy, again.sentence.text], [false, 75, 'Yes, a coffee please.']);
  notebook = await service.listMistakes(student);
  assert.deepEqual([notebook.mistakes[0].timesMissed, notebook.mistakes[0].missedWords], [3, [{ text: 'please.', typed: null }]]);
  assert.deepEqual(notebook.mostMissedWords, [{ word: 'please', count: 3 }]);

  // Written right, it leaves the notebook.
  const fixed = await service.checkMistake(student, mistake.id, { text: 'Yes, a coffee, please' });
  assert.equal(fixed.fixed, true);
  assert.deepEqual((await service.listMistakes(student)).mistakes, []);
  await assert.rejects(() => service.checkMistake(student, mistake.id, { text: '' }), { code: 60 });

  // A sentence right in a lesson also leaves it.
  await service.complete(student, unit.id, { lessonId: lesson.id, answers });
  assert.equal((await service.listMistakes(student)).mistakes.length, 1);
  await service.complete(student, unit.id, { lessonId: lesson.id, answers: rightAnswers(lesson, segments) });
  assert.equal((await service.listMistakes(student)).mistakes.length, 0);
});

test('the progress of the learner by level', async () => {
  const { service, unit, paper, segments, levelTest } = courseHarness();
  const empty = await service.getProgress(student);
  assert.deepEqual(
    [empty.currentLevel, empty.lessons, empty.averageBestScore, empty.attemptCount, empty.mistakeCount, empty.placement],
    ['A1', { passed: 0, total: 4 }, null, 0, 0, null],
  );

  const [first, second] = paper.content.lessons;
  await service.complete(student, unit.id, { lessonId: first.id, answers: rightAnswers(first, segments) });
  const low = rightAnswers(second, segments);
  for (const question of second.detail) low[question.id] = '';
  await service.complete(student, unit.id, { lessonId: second.id, answers: low });
  await service.submitTest(student, levelTest.item.id, { answers: testAnswers(levelTest, 2) });

  const progress = await service.getProgress(student);
  // 100% and 60%: one passed, average 80, two attempts.
  assert.deepEqual([progress.lessons, progress.averageBestScore, progress.attemptCount], [{ passed: 1, total: 4 }, 80, 2]);
  assert.deepEqual(progress.levels[0], {
    level: 'A1',
    state: 'CURRENT',
    lessons: { passed: 1, total: 3 },
    unitChecks: { passed: 0, total: 2 },
    levelTest: { bestScore: 50, passed: false },
  });
  assert.deepEqual(progress.levels[1], {
    level: 'A2',
    state: 'LOCKED',
    lessons: { passed: 0, total: 1 },
    unitChecks: { passed: 0, total: 1 },
    levelTest: null,
  });
  await assert.rejects(() => service.getProgress(manager), { code: 26 });
});

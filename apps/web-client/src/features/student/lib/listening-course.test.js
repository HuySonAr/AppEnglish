import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseLessonPath,
  courseStepsOf,
  courseTestPath,
  filterCourseUnits,
  filterMistakes,
  levelProgress,
  missedWordLabel,
  nextPath,
  startingLevel,
  stepAfter,
  unanswered,
  unfilledBlanks,
} from './listening-course.js';

test('the steps of a lesson with or without Focus on; blanks count as unanswered (D109)', () => {
  assert.deepEqual(
    courseStepsOf(false).map((step) => step.key),
    ['keywords', 'gist', 'detail', 'close', 'review'],
  );
  assert.deepEqual(
    courseStepsOf(true).map((step) => step.key),
    ['keywords', 'gist', 'detail', 'focus', 'close', 'review'],
  );
  assert.deepEqual([stepAfter('detail', false), stepAfter('detail', true), stepAfter('review', true)], ['close', 'focus', null]);
  const questions = [
    { id: 'q1', kind: 'choice' },
    { id: 'q2', kind: 'complete', blankCount: 2 },
  ];
  assert.deepEqual(
    unanswered(questions, { q1: 'o1', 'q2:0': 'from' }).map((question) => question.id),
    ['q2'],
  );
  assert.deepEqual(unanswered(questions, { q1: 'o1', 'q2:0': 'from', 'q2:1': ' here ' }), []);
  assert.deepEqual(unfilledBlanks('focus', 3, { 'focus:1': 'going' }), [0, 2]);
});

const lesson = (id, title, state = 'OPEN') => ({ id, title, state });
const units = [
  { id: 'u1', title: 'Shopping', lessons: [lesson('l1', 'At the café', 'PASSED'), lesson('l2', 'Paying')] },
  { id: 'u2', title: 'Travel', lessons: [lesson('l3', 'At the airport', 'LOCKED')] },
];

test('the units of a level are searched and filtered by lesson state', () => {
  const all = { search: '', status: 'all' };
  assert.deepEqual(
    filterCourseUnits(units, all).map((unit) => unit.lessons.length),
    [2, 1],
  );
  // A unit title keeps every lesson; a lesson title only that one; accents do not count.
  assert.deepEqual(
    filterCourseUnits(units, { search: 'shopping', status: 'all' }).map((unit) => unit.lessons.length),
    [2],
  );
  assert.deepEqual(
    filterCourseUnits(units, { search: 'cafe', status: 'all' }).map((unit) => unit.lessons.map((item) => item.id)),
    [['l1']],
  );
  assert.deepEqual(
    filterCourseUnits(units, { search: '', status: 'passed' }).map((unit) => unit.id),
    ['u1'],
  );
  assert.deepEqual(
    filterCourseUnits(units, { search: '', status: 'open' }).map((unit) => unit.lessons.map((item) => item.id)),
    [['l2']],
  );
  assert.deepEqual(
    filterCourseUnits(units, { search: '', status: 'locked' }).map((unit) => unit.id),
    ['u2'],
  );
  assert.deepEqual(filterCourseUnits(units, { search: 'nothing', status: 'all' }), []);
});

test('the level shown first and the progress of a level', () => {
  const levels = [
    { level: 'A1', units },
    { level: 'A2', units },
    { level: 'B1', units: [] },
  ];
  assert.equal(startingLevel({ currentLevel: 'A2', levels }), 'A2');
  // Every level passed: the last level with units.
  assert.equal(startingLevel({ currentLevel: null, levels }), 'A2');
  assert.equal(startingLevel({ currentLevel: null, levels: [{ level: 'A1', units: [] }] }), 'A1');
  assert.deepEqual(levelProgress(levels[0]), { passed: 1, total: 3 });
});

test('paths and unanswered questions', () => {
  assert.equal(courseLessonPath('u1', 'l1'), '/student/listening-course/units/u1/lessons/l1');
  assert.equal(courseTestPath('t1'), '/student/listening-course/tests/t1');
  assert.equal(nextPath({ type: 'lesson', unitId: 'u1', lessonId: 'l1' }), '/student/listening-course/units/u1/lessons/l1');
  assert.equal(nextPath({ type: 'unit_check', itemId: 'u1' }), '/student/listening-course/tests/u1');
  assert.deepEqual(
    unanswered([{ id: 'a' }, { id: 'b' }], { a: 'x' }).map((question) => question.id),
    ['b'],
  );
});

test('the mistakes notebook is searched, filtered by level and sorted', () => {
  const mistake = (id, level, lessonTitle, words, timesMissed, lastMissedAt) => ({
    id,
    level,
    lessonTitle,
    unitTitle: 'Unit',
    missedWords: words.map((text) => ({ text, typed: null })),
    timesMissed,
    lastMissedAt,
  });
  const mistakes = [
    mistake('a', 'A1', 'Ordering', ['coffee'], 1, '2026-10-14T08:00:00Z'),
    mistake('b', 'A2', 'Airport', ['gate'], 3, '2026-10-13T08:00:00Z'),
    mistake('c', 'A1', 'Café', ['café'], 2, '2026-10-12T08:00:00Z'),
  ];
  const ids = (filters) => filterMistakes(mistakes, { search: '', level: 'all', sort: 'latest', ...filters }).map((item) => item.id);
  assert.deepEqual(ids({}), ['a', 'b', 'c']);
  assert.deepEqual(ids({ sort: 'most' }), ['b', 'c', 'a']);
  assert.deepEqual(ids({ sort: 'lesson' }), ['b', 'c', 'a']);
  assert.deepEqual(ids({ level: 'A1' }), ['a', 'c']);
  // By a missed word, without accents.
  assert.deepEqual(ids({ search: 'cafe' }), ['c']);
  assert.equal(missedWordLabel({ text: 'please.', typed: null }), 'please (left out)');
  assert.equal(missedWordLabel({ text: 'coffee', typed: 'tea' }), 'coffee (you wrote “tea”)');
});

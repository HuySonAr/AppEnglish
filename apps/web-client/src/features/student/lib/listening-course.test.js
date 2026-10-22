import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CourseTopicFilter,
  blankedText,
  courseTestPath,
  courseTopicPath,
  filterTopics,
  levelProgress,
  moveItem,
  nextStep,
  orderingResult,
  startingLevel,
  unanswered,
} from './listening-course.js';

const topics = [
  { id: 't1', title: 'Ordering food', description: 'At a café', done: true },
  { id: 't2', title: 'Paying', description: '', done: false },
  { id: 't3', title: 'Café talk', description: 'Small talk', done: false },
];

test('topics are searched (accents ignored) and filtered by done (D145)', () => {
  assert.deepEqual(filterTopics(topics, {}).map((topic) => topic.id), ['t1', 't2', 't3']);
  assert.deepEqual(filterTopics(topics, { search: 'cafe' }).map((topic) => topic.id), ['t1', 't3']);
  assert.deepEqual(filterTopics(topics, { status: CourseTopicFilter.DONE }).map((topic) => topic.id), ['t1']);
  assert.deepEqual(filterTopics(topics, { status: CourseTopicFilter.TODO, search: 'pay' }).map((topic) => topic.id), ['t2']);
  assert.deepEqual(levelProgress({ topics }), { done: 1, total: 3 });
});

test('the next step: the first topic not done of the current level, else its level test', () => {
  const course = {
    currentLevel: 'A1',
    levels: [
      { level: 'A1', state: 'OPEN', topics, levelTest: { id: 'x', title: 'A1 test', passed: false } },
      { level: 'A2', state: 'LOCKED', topics: [], levelTest: null },
    ],
  };
  assert.deepEqual(nextStep(course), { type: 'topic', level: 'A1', id: 't2', title: 'Paying', path: courseTopicPath('t2') });
  const allDone = { ...course, levels: [{ ...course.levels[0], topics: topics.map((topic) => ({ ...topic, done: true })) }, course.levels[1]] };
  assert.deepEqual(nextStep(allDone), { type: 'level_test', level: 'A1', id: 'x', title: 'A1 test', path: courseTestPath('x') });
  assert.equal(nextStep({ ...allDone, levels: [{ ...allDone.levels[0], levelTest: null }] }), null);
  assert.equal(nextStep(null), null);
  assert.equal(startingLevel(course), 'A1');
  assert.equal(startingLevel({ currentLevel: null, levels: [{ level: 'A1' }] }), 'A1');
});

test('ordering: moving ideas and checking the order', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
  assert.deepEqual(orderingResult(['a', 'c', 'b'], ['a', 'b', 'c']), { correct: false, right: [true, false, false] });
  assert.equal(orderingResult(['a', 'b'], ['a', 'b']).correct, true);
});

test('questions left and blanked sentences', () => {
  assert.deepEqual(unanswered([{ id: 'q1' }, { id: 'q2' }], { q1: 'o1' }).map((question) => question.id), ['q2']);
  assert.equal(blankedText([{ text: 'Yes, a ' }, { blank: 0, answer: 'coffee' }, { text: ' please.' }]), 'Yes, a ___ please.');
});

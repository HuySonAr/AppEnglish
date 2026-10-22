import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeSentence,
  blankMark,
  typingMarks,
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

test('each word is marked as it is typed: right, still being typed, or wrong at once', () => {
  const sentence = "I'd like a coffee, please.";
  assert.deepEqual(typingMarks(sentence, ''), { marks: [], right: 0, total: 5, done: false });
  assert.deepEqual(typingMarks(sentence, 'i’d li').marks.map((mark) => mark.status), ['right', 'typing']);
  assert.deepEqual(typingMarks(sentence, 'Id lake').marks.map((mark) => mark.status), ['right', 'wrong']);
  assert.deepEqual(typingMarks(sentence, 'Id like ').marks.map((mark) => mark.status), ['right', 'right']);
  const wrongEarly = typingMarks(sentence, 'I would like a coffee please');
  assert.equal(wrongEarly.marks[1].status, 'wrong');
  assert.equal(wrongEarly.marks[5].status, 'extra');
  const done = typingMarks(sentence, "I'd like a COFFEE please");
  assert.deepEqual([done.right, done.total, done.done], [5, 5, true]);
  assert.equal(typingMarks('It costs twenty pounds.', 'it costs 20 pounds').done, true);
  assert.equal(typingMarks('A well-known café.', 'a well known cafe').done, true);
  assert.equal(typingMarks('It was 2,500 dollars.', 'it was 2500 dollars').done, true);
});

test('a blank is right, still being typed, wrong or empty', () => {
  assert.equal(blankMark('coffee', ''), 'empty');
  assert.equal(blankMark('coffee', 'cof'), 'typing');
  assert.equal(blankMark('coffee', 'Coffee'), 'right');
  assert.equal(blankMark('coffee', 'cafe'), 'wrong');
  assert.equal(blankMark('coffee', 'cof '), 'wrong');
  assert.equal(blankMark('get in touch', 'get in'), 'typing');
});

test('the transcript follows the sentence being played', () => {
  const sentences = [{ start: 0 }, { start: 2.5 }, { start: null }, { start: 6 }];
  assert.equal(activeSentence(sentences, 0), 0);
  assert.equal(activeSentence(sentences, 2.46), 1);
  assert.equal(activeSentence(sentences, 5.9), 1);
  assert.equal(activeSentence(sentences, 7), 3);
  assert.equal(activeSentence([], 3), -1);
});


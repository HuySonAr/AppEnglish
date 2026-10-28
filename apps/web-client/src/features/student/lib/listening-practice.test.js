import test from 'node:test';
import assert from 'node:assert/strict';
import { TOEIC_MODES, activeSentence, filterListeningPractice, isTimed, maskedWords, isTried, kindLabel, lineAnswers, lineBlanks, partGroups, resultOf, runningScore, sentenceLabel, testLevel, toeicModeOf, topicModes } from './listening-practice.js';

test('listening exercises are filtered by topic, searched and sorted', () => {
  const exercises = [
    { title: 'Gate', topic: { id: 't1' }, level: 'B1', kind: 'part3', bestAccuracy: 80, checkCount: 2 },
    { title: 'Photo', topic: { id: 't1' }, level: 'A2', kind: 'part1', bestAccuracy: null, checkCount: 0 },
    { title: 'Office', topic: { id: 't1' }, level: 'B1', kind: 'part1', bestAccuracy: 40, checkCount: 1 },
    { title: 'Song', topic: { id: 't2' }, level: 'A1', kind: 'part1', bestAccuracy: null, checkCount: 0 },
  ];
  const base = { topic: 't1', search: '', level: 'all', kind: 'all', done: 'all', sort: 'level' };
  const titles = (options) => filterListeningPractice(exercises, { ...base, ...options }).map((item) => item.title);
  assert.deepEqual(titles({}), ['Photo', 'Office', 'Gate']);
  assert.deepEqual(titles({ sort: 'best' }), ['Office', 'Gate', 'Photo']);
  assert.deepEqual(titles({ done: 'new' }), ['Photo']);
  assert.deepEqual(titles({ done: 'done', level: 'B1', kind: 'part1' }), ['Office']);
  assert.deepEqual(titles({ search: 'ga', sort: 'title' }), ['Gate']);
  assert.deepEqual(titles({ topic: 't2' }), ['Song']);
});

test('sentences are named by part and can be replayed when timed', () => {
  assert.deepEqual([0, 3].map((index) => sentenceLabel('part2', index)), ['Question', '(C)']);
  assert.equal(sentenceLabel('part3', 1, 'Woman'), 'Sentence 2 · Woman');
  assert.equal(sentenceLabel('part4', 0, ''), 'Sentence 1');
  assert.equal(kindLabel('part4'), 'Part 4 · Talk');
  assert.deepEqual([{ start: 0, end: 2 }, { start: null, end: null }, { start: 3, end: 3 }].map(isTimed), [true, false, false]);
});

test('songs are named by line, and a song filled in only counts as tried', () => {
  assert.equal(kindLabel('song'), 'Song');
  assert.equal(sentenceLabel('song', 2, ''), 'Line 3');
  assert.deepEqual(
    [{ checkCount: 0, blanks: { checkCount: 2 } }, { checkCount: 0, blanks: { checkCount: 0 } }, { checkCount: 1 }].map(isTried),
    [true, false, true],
  );
});

test('a song topic is practised in two modes, each with its own exercises and results (D92)', () => {
  assert.deepEqual(topicModes({ format: 'song' }), ['blanks', 'full']);
  assert.deepEqual(topicModes({ format: 'toeic' }), ['full']);
  const songs = [
    { title: 'Home', topic: { id: 's' }, level: 'A2', kind: 'song', blankCount: 3, bestAccuracy: 40, checkCount: 1, blanks: { bestAccuracy: 90, checkCount: 2 } },
    { title: 'Away', topic: { id: 's' }, level: 'A2', kind: 'song', blankCount: 0, bestAccuracy: null, checkCount: 0, blanks: { bestAccuracy: null, checkCount: 0 } },
    { title: 'Road', topic: { id: 's' }, level: 'B1', kind: 'song', blankCount: 2, bestAccuracy: 70, checkCount: 1, blanks: { bestAccuracy: null, checkCount: 0 } },
  ];
  const base = { topic: 's', search: '', level: 'all', kind: 'all', done: 'all', sort: 'title' };
  const titles = (options) => filterListeningPractice(songs, { ...base, ...options }).map((item) => item.title);
  assert.deepEqual(titles({ mode: 'blanks' }), ['Home', 'Road']);
  assert.deepEqual(titles({ mode: 'full' }), ['Away', 'Home', 'Road']);
  assert.deepEqual(titles({ mode: 'blanks', done: 'new' }), ['Road']);
  assert.deepEqual(titles({ mode: 'full', sort: 'best' }), ['Home', 'Road', 'Away']);
  assert.equal(resultOf(songs[0], 'blanks').bestAccuracy, 90);
});

test('one song line at a time: its answers and the score so far (D93)', () => {
  const line = { id: 'b', pieces: [{ text: 'And ' }, { blank: 2 }, { text: ' then ' }, { blank: 3 }] };
  assert.deepEqual(lineBlanks(line), [2, 3]);
  assert.deepEqual(lineBlanks({ id: 'c', pieces: [{ text: 'No blank' }] }), []);
  assert.deepEqual(lineAnswers('blanks', line, { 0: 'x', 2: 'stayed' }), { 2: 'stayed', 3: '' });
  assert.deepEqual(lineAnswers('full', { id: 'a' }, { a: 'I walked', b: 'other' }), { a: 'I walked' });
  assert.equal(runningScore({}), null);
  assert.equal(runningScore({ a: { accuracy: 100 }, b: { accuracy: 50 }, c: { accuracy: null } }), 75);
});

test('a checked sentence hides the wrong and missing words behind asterisks', () => {
  const words = [
    { text: 'Today', status: 'correct' },
    { text: 'is', status: 'correct' },
    { text: 'November', status: 'wrong', typed: 'December' },
    { text: '26th.', status: 'missing' },
    { text: 'very', status: 'extra' },
  ];
  assert.deepEqual(maskedWords(words), [
    { text: 'Today', status: 'correct' },
    { text: 'is', status: 'correct' },
    { text: '********', status: 'hidden' },
    { text: '****', status: 'hidden' },
    { text: 'very', status: 'extra' },
  ]);
});

test('the transcript follows the sentence being played', () => {
  const sentences = [{ start: 0 }, { start: 2.5 }, { start: null }, { start: 6 }];
  assert.equal(activeSentence(sentences, 0), 0);
  assert.equal(activeSentence(sentences, 2.46), 1);
  assert.equal(activeSentence(sentences, 5.9), 1);
  assert.equal(activeSentence(sentences, 7), 3);
  assert.equal(activeSentence([], 3), -1);
});

test('TOEIC tests use three hiding modes, keep a best per mode and group exercises by part', () => {
  assert.deepEqual(TOEIC_MODES, ['hide30', 'hide50', 'hide100']);
  assert.deepEqual(['hide50', 'nope', null].map(toeicModeOf), ['hide50', 'hide30', 'hide30']);
  const exercise = { bestAccuracy: 70, checkCount: 1, hide30: { bestAccuracy: 90, checkCount: 2 }, hide50: { bestAccuracy: null, checkCount: 0 } };
  assert.deepEqual([resultOf(exercise, 'hide30').bestAccuracy, resultOf(exercise, 'full').bestAccuracy], [90, 70]);
  assert.equal(isTried({ checkCount: 0, hide50: { checkCount: 1 } }), true);
  assert.deepEqual(lineAnswers('hide30', { id: 's', pieces: [{ text: 'A ' }, { blank: 's:2' }] }, {}), { 's:2': '' });
  const groups = partGroups([{ id: 'b', kind: 'part3' }, { id: 'a', kind: 'part1' }, { id: 'c', kind: 'part3' }]);
  assert.deepEqual(groups.map((group) => [group.kind.number, group.exercises.map((item) => item.id)]), [[1, ['a']], [3, ['b', 'c']]]);
  assert.deepEqual(testLevel('basic'), { label: 'Basic', scores: 'TOEIC Listening below 250' });
  assert.equal(testLevel(null), null);
});

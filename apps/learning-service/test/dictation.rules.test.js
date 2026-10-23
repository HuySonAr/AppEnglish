import test from 'node:test';
import assert from 'node:assert/strict';
import { accuracyOf, checkSentence, tokens, words } from '../src/listening/dictation.rules.js';

const values = (text) => tokens(words(text)).map((token) => token.value);
const statuses = (expected, typed) => checkSentence(expected, typed).words.map((word) => `${word.text}:${word.status}${word.typed ? `>${word.typed}` : ''}`);

test('case and punctuation are ignored', () => {
  assert.deepEqual(values('Excuse me, where is Gate 5?'), ['excuse', 'me', 'where', 'is', 'gate', '5']);
  assert.deepEqual(checkSentence('Excuse me, where is Gate 5?', 'excuse me where is gate 5'), {
    words: ['Excuse', 'me,', 'where', 'is', 'Gate', '5?'].map((text) => ({ text, status: 'correct' })),
    total: 6,
    errors: 0,
  });
});

test('contractions count as their full form', () => {
  assert.deepEqual(values("I don't think it's ready; we'll see, won't we? Let's go. She'd left. John's car."), [
    'i', 'do', 'not', 'think', 'it', "'s", 'ready', 'we', 'will', 'see', 'will', 'not', 'we', 'let', 'us', 'go', 'she', "'d", 'left', "john's", 'car',
  ]);
  assert.equal(checkSentence("I don't think it's ready.", 'I do not think it is ready').errors, 0);
  assert.equal(checkSentence('I do not think it has gone.', "I don't think it's gone").errors, 0);
  assert.equal(checkSentence("She'd like a cup.", 'She would like a cup').errors, 0);
  assert.equal(checkSentence('We cannot stay.', "We can't stay").errors, 0);
  assert.equal(checkSentence('A café in Montréal.', 'a cafe in montreal').errors, 0);
  assert.equal(checkSentence('I’m here.', "I am here").errors, 0);
});

test('numbers in words count as digits', () => {
  assert.deepEqual(values('Twenty-one people, two thousand five hundred dollars and one hundred and five boxes'), [
    '21', 'people', '2500', 'dollars', 'and', '105', 'boxes',
  ]);
  assert.equal(checkSentence('The meeting is at 5.', 'the meeting is at five').errors, 0);
  assert.equal(checkSentence('It costs 2,500 dollars.', 'it costs two thousand five hundred dollars').errors, 0);
  assert.deepEqual(statuses('Room twenty-one.', 'room 21'), ['Room:correct', 'twenty-one.:correct']);
});

test('wrong, missing and extra words are marked in place', () => {
  assert.deepEqual(statuses('The train to Boston is delayed.', 'the train for Boston is very delayed'), [
    'The:correct', 'train:correct', 'to:wrong>for', 'Boston:correct', 'is:correct', 'very:extra', 'delayed.:correct',
  ]);
  const missing = checkSentence('Please take your seats now.', 'please your seats');
  assert.deepEqual(missing.words.map((word) => word.status), ['correct', 'missing', 'correct', 'correct', 'missing']);
  assert.deepEqual([missing.total, missing.errors, accuracyOf(missing.total, missing.errors)], [5, 2, 60]);
  assert.deepEqual(statuses("I don't know.", 'I do know'), ['I:correct', "don't:wrong", 'know.:correct']);
  assert.deepEqual(checkSentence('Hello there.', '').words.map((word) => word.status), ['missing', 'missing']);
  const noisy = checkSentence('Hi.', 'oh hi there you all');
  assert.deepEqual([noisy.errors, accuracyOf(noisy.total, noisy.errors)], [4, 0]);
});

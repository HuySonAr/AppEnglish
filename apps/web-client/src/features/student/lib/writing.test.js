import test from 'node:test';
import assert from 'node:assert/strict';
import { errorSegments, wordHint, wordMeter, wordRangeState } from './writing.js';

test('errors are marked where they first appear, without overlaps, in reading order', () => {
  const answer = 'I want take a day off. I want take it Friday.';
  const segments = errorSegments(answer, [
    { text: 'Friday', suggestion: 'on Friday' },
    { text: 'want take', suggestion: 'want to take' },
    { text: 'want take', suggestion: 'want to take' },
    { text: 'missing', suggestion: 'x' },
  ]);
  assert.equal(segments.map((segment) => segment.text).join(''), answer);
  assert.deepEqual(segments.filter((segment) => segment.error !== undefined).map((segment) => [segment.text, segment.error]), [['want take', 1], ['want take', 2], ['Friday', 0]]);
  assert.deepEqual(errorSegments('abc', []), [{ text: 'abc' }]);
});

test('the word counter says whether the text fits the limits', () => {
  assert.deepEqual([[0, 5, 10], [3, 5, 10], [7, 5, 10], [11, 5, 10]].map(([words, min, max]) => wordRangeState(words, min, max)), ['empty', 'short', 'ok', 'long']);
});

test('the word meter shows the allowed range and what is left', () => {
  assert.deepEqual(wordMeter(60, 80, 120), { fill: 41.7, zoneStart: 55.6, zoneEnd: 83.3, state: 'short' });
  assert.equal(wordMeter(500, 80, 120).fill, 100);
  assert.deepEqual([0, 79, 80, 121].map((words) => wordHint(words, 80, 120)), ['Write 80–120 words.', '1 more word to go.', 'Ready to submit.', '1 word over the limit.']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressResponseCode, ProgressSource, wholePercent } from '../src/index.js';

test('whole percents round the exact value; no value stays null', () => {
  assert.equal(wholePercent(0.785), 79);
  assert.equal(wholePercent(2 / 3), 67);
  assert.equal(wholePercent(1), 100);
  assert.equal(wholePercent(0), 0);
  assert.equal(wholePercent(null), null);
  assert.equal(wholePercent(undefined), null);
});

test('codes and sources are fixed', () => {
  assert.deepEqual(ProgressResponseCode, { SUCCESS: 0, FORBIDDEN_ROLE: 26, VALIDATION_ERROR: 30, SYSTEM_ERROR: 32 });
  assert.deepEqual(Object.values(ProgressSource), ['LESSON_TEST', 'MOCK_TEST']);
});

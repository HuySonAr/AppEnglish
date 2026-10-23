import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLACEMENT_THRESHOLDS, lessonTestPassed, placementStartUnit } from '../src/index.js';

const unit = (correct, total, units = 5, thresholds = DEFAULT_PLACEMENT_THRESHOLDS) =>
  placementStartUnit(correct, total, thresholds, units);

test('start unit follows the 60 and 80 percent thresholds exactly', () => {
  assert.equal(unit(59, 100), 1);
  assert.equal(unit(60, 100), 2);
  assert.equal(unit(79, 100), 2);
  assert.equal(unit(80, 100), 3);
  assert.deepEqual([0, 13, 14, 18, 19, 23].map((correct) => unit(correct, 23)), [1, 1, 2, 2, 3, 3]);
  assert.equal(unit(599, 1000), 1);
  assert.equal(unit(0, 0), 1);
});

test('start unit respects changed thresholds and the number of published units', () => {
  assert.equal(unit(14, 23, 5, { unit2Threshold: 70, unit3Threshold: 90 }), 1);
  assert.equal(unit(23, 23, 2), 2);
  assert.equal(unit(23, 23, 1), 1);
  assert.equal(unit(23, 23, 0), 1);
});

test('a lesson test passes from 80 percent exactly', () => {
  assert.equal(lessonTestPassed(79, 100), false);
  assert.equal(lessonTestPassed(80, 100), true);
  assert.equal(lessonTestPassed(18, 23), false);
  assert.equal(lessonTestPassed(19, 23), true);
  assert.equal(lessonTestPassed(799, 1000), false);
  assert.equal(lessonTestPassed(0, 0), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSwValues, swActionFor, swApproxScaled, swInvalidNumbers, swPayloadItems, swRawTotal, swValuesChanged } from './sw-review.js';

const items = [
  { number: 1, task: 'read_aloud', maxScore: 3, ai: { stage: 'done', score: 2.5, pronunciation: 3, intonation: 2 } },
  { number: 3, task: 'describe_picture', maxScore: 3, ai: { stage: 'done', score: 2 } },
  { number: 11, task: 'express_opinion', maxScore: 5, ai: { stage: 'done', score: 4 } },
];

test('the form starts from the AI scores', () => {
  assert.deepEqual(initialSwValues(items), { 1: { pronunciation: '3', intonation: '2' }, 3: { score: '2' }, 11: { score: '4' } });
  assert.deepEqual(initialSwValues([{ number: 2, task: 'read_aloud', maxScore: 3, ai: null }, { number: 5, task: 'respond_questions', maxScore: 3, ai: { stage: 'failed' } }]), {
    2: { pronunciation: '', intonation: '' },
    5: { score: '' },
  });
});

test('the raw total follows the server formula and needs every score in range', () => {
  const values = initialSwValues(items);
  assert.equal(swRawTotal(items, values), 8.5);
  assert.deepEqual(swInvalidNumbers(items, values), []);
  const bad = { ...values, 11: { score: '6' }, 1: { pronunciation: '1.5', intonation: '2' } };
  assert.equal(swRawTotal(items, bad), null);
  assert.deepEqual(swInvalidNumbers(items, bad), [1, 11]);
  assert.deepEqual(swInvalidNumbers(items, { ...values, 3: { score: '' } }), [3]);
});

test('the approximate scaled score uses the default table', () => {
  assert.equal(swApproxScaled('speaking', 35), 200);
  assert.equal(swApproxScaled('speaking', 17.5), 100);
  assert.equal(swApproxScaled('writing', 14), 100);
  assert.equal(swApproxScaled('writing', null), null);
});

test('the action depends on the AI score and on what changed', () => {
  const values = initialSwValues(items);
  assert.equal(swValuesChanged(items, values), false);
  assert.equal(swValuesChanged(items, { ...values, 1: { pronunciation: '2', intonation: '2' } }), true);
  assert.deepEqual([swActionFor(true, false), swActionFor(true, true), swActionFor(false, false)], ['CONFIRM', 'EDIT', 'FROM_SCRATCH']);
});

test('the payload sends read-aloud parts and whole scores', () => {
  assert.deepEqual(swPayloadItems(items, initialSwValues(items)), { 1: { pronunciation: 3, intonation: 2 }, 3: 2, 11: 4 });
});

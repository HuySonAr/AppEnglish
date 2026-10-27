import test from 'node:test';
import assert from 'node:assert/strict';
import { swDefaultConversion } from '@appenglish/learning-contracts';
import { checkSwTable, sameTable, swTableLength, toSwInputs } from './sw-conversion.js';

const defaults = swDefaultConversion();

test('the tables have one score per raw point', () => {
  assert.equal(swTableLength('speaking'), 36);
  assert.equal(swTableLength('writing'), 29);
  const inputs = toSwInputs(defaults);
  assert.deepEqual(checkSwTable('speaking', inputs.speaking).values, defaults.speaking);
  assert.deepEqual(checkSwTable('writing', inputs.writing).values, defaults.writing);
});

test('scores must be multiples of 10 from 0 to 200 and never go down', () => {
  const inputs = toSwInputs(defaults).writing;
  const odd = [...inputs];
  odd[3] = '25';
  assert.deepEqual(checkSwTable('writing', odd).bad, [3]);
  const empty = [...inputs];
  empty[5] = '';
  assert.deepEqual(checkSwTable('writing', empty).bad, [5]);
  const down = [...inputs];
  down[10] = '0';
  assert.deepEqual(checkSwTable('writing', down).bad, [10]);
  assert.match(checkSwTable('writing', down).error, /go down/);
  assert.match(checkSwTable('writing', inputs.slice(1)).error, /29/);
});

test('a table is unchanged when every value matches', () => {
  assert.equal(sameTable(['0', '10'], [0, 10]), true);
  assert.equal(sameTable(['0', '20'], [0, 10]), false);
});

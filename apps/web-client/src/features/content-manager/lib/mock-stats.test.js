import test from 'node:test';
import assert from 'node:assert/strict';
import { StatSort, filterStatQuestions, flaggedQuestions } from './mock-stats.js';

const question = (number, fields = {}) => ({ id: `q${number}`, number, partKey: number > 100 ? 'part5' : 'part1', prompt: '', rate: 50, skipped: 0, flag: null, options: [{ text: '' }], ...fields });

test('flagged questions come answer checks first, then the hardest', () => {
  const list = [question(1, { flag: 'EASY', rate: 98 }), question(2, { flag: 'HARD', rate: 20 }), question(3, { flag: 'CHECK_KEY', rate: 40 }), question(4), question(5, { flag: 'HARD', rate: 10 })];
  assert.deepEqual(flaggedQuestions(list).map((item) => item.number), [3, 5, 2, 1]);
});

test('stat questions are searched, filtered by part and sorted', () => {
  const list = [question(1, { rate: 80, skipped: 1 }), question(101, { prompt: 'The ___ is late.', rate: 20, skipped: 3 }), question(2, { rate: null }), question(102, { options: [{ text: 'train' }], rate: 60 })];
  assert.deepEqual(filterStatQuestions(list, { sort: StatSort.HARDEST }).map((item) => item.number), [2, 101, 102, 1]);
  assert.deepEqual(filterStatQuestions(list, { sort: StatSort.EASIEST }).map((item) => item.number), [1, 102, 101, 2]);
  assert.deepEqual(filterStatQuestions(list, { sort: StatSort.SKIPPED }).map((item) => item.number), [101, 1, 2, 102]);
  assert.deepEqual(filterStatQuestions(list, { part: 'part5' }).map((item) => item.number), [101, 102]);
  assert.deepEqual(filterStatQuestions(list, { search: 'train' }).map((item) => item.number), [102]);
  assert.deepEqual(filterStatQuestions(list, { search: 'late' }).map((item) => item.number), [101]);
});

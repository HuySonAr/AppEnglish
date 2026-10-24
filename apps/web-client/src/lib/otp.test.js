import test from 'node:test';
import assert from 'node:assert/strict';
import { cellAt, clearDigit, digitsOf, fillDigits, isComplete } from './otp.js';

test('typing fills one box and moves on; pasting fills the rest', () => {
  assert.deepEqual(fillDigits('', 0, '4'), { value: '4', focus: 1 });
  assert.deepEqual(fillDigits('12', 2, '3'), { value: '123', focus: 3 });
  assert.deepEqual(fillDigits('', 0, '123 456'), { value: '123456', focus: 5 });
  assert.deepEqual(fillDigits('9', 1, '1234567'), { value: '912345', focus: 5 });
  assert.deepEqual(fillDigits('12', 2, 'ab'), { value: '12', focus: 2 });
  assert.equal(digitsOf('Code: 48-21 90'), '482190');
});

test('backspace clears the box, or the one before when it is empty', () => {
  assert.deepEqual(clearDigit('123', 2), { value: '12', focus: 2 });
  assert.deepEqual(clearDigit('12', 2), { value: '1', focus: 1 });
  assert.deepEqual(clearDigit('', 0), { value: '', focus: 0 });
  assert.equal(isComplete('123456'), true);
  assert.equal(isComplete('12345'), false);
  const gap = clearDigit('123456', 2);
  assert.deepEqual(gap, { value: '12 456', focus: 2 });
  assert.equal(isComplete(gap.value), false);
  assert.deepEqual([cellAt(gap.value, 2), cellAt(gap.value, 3)], ['', '4']);
  assert.deepEqual(fillDigits(gap.value, 2, '9'), { value: '129456', focus: 3 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { percentOf, prefersReducedMotion } from './motion.js';

test('percentOf clamps to 0..100 and handles an empty total', () => {
  assert.equal(percentOf(3, 4), 75);
  assert.equal(percentOf(9, 4), 100);
  assert.equal(percentOf(-1, 4), 0);
  assert.equal(percentOf(2, 0), 0);
});

test('prefersReducedMotion is false without a window', () => {
  assert.equal(prefersReducedMotion(), false);
});

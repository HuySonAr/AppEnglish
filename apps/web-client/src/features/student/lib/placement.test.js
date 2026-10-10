import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredCount, formatRemaining, numberBlanks, remainingTime } from './placement.js';

test('remaining time is shown as minutes and seconds', () => {
  assert.equal(formatRemaining(25 * 60 * 1000), '25:00');
  assert.equal(formatRemaining(61 * 1000), '01:01');
  assert.equal(formatRemaining(900), '00:01');
  assert.equal(formatRemaining(0), '00:00');
  assert.equal(formatRemaining(-5000), '00:00');
});

test('remaining time follows the server clock', () => {
  const expiresAt = '2026-10-10T08:25:00.000Z';
  const serverNow = Date.parse('2026-10-10T08:10:00.000Z');
  // The browser clock is one hour ahead of the server.
  const browserNow = serverNow + 60 * 60 * 1000;
  const offset = serverNow - browserNow;
  assert.equal(remainingTime(expiresAt, offset, browserNow), 15 * 60 * 1000);
  assert.equal(remainingTime(expiresAt, offset, browserNow + 60 * 1000), 14 * 60 * 1000);
});

test('blanks in a passage carry their question numbers', () => {
  assert.equal(numberBlanks('Dear ___, your ___ is at the ___.', 16), 'Dear (16) ___, your (17) ___ is at the (18) ___.');
  assert.equal(numberBlanks('No blank.', 16), 'No blank.');
});

test('answered questions are counted', () => {
  const parts = [{ questions: [{ id: 'a' }, { id: 'b' }] }, { questions: [{ id: 'c' }] }];
  assert.equal(answeredCount(parts, { a: 'x', c: 'y', other: 'z' }), 2);
  assert.equal(answeredCount(parts, {}), 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysBetween, monthGrid, toIsoDay } from './calendar.js';

test('a month grid starts on Monday and holds whole weeks', () => {
  const october = monthGrid(2026, 9);
  assert.equal(october[0][0].iso, '2026-09-28');
  assert.deepEqual(october[0].slice(2, 4).map((day) => [day.iso, day.inMonth]), [['2026-09-30', false], ['2026-10-01', true]]);
  assert.equal(october.length, 5);
  assert.equal(october.at(-1).at(-1).iso, '2026-11-01');
  assert.equal(monthGrid(2026, 7).length, 6);
  assert.ok(monthGrid(2026, 1).flat().filter((day) => day.inMonth).length === 28);
});

test('months move without overflowing the day, and days are counted', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-10-23', 3), '2027-01-23');
  assert.equal(addMonths('2026-03-15', -2), '2026-01-15');
  assert.equal(daysBetween('2026-10-23', '2026-12-18'), 56);
  assert.equal(toIsoDay(new Date(2026, 0, 5)), '2026-01-05');
});

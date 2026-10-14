import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_CHART_LATEST, scoreChartPoints } from './score-chart.js';

const attempt = (attemptNumber, day, scorePercent, passed) => ({
  attemptNumber,
  scorePercent,
  passed,
  submittedAt: new Date(2026, 8, day, 12).toISOString(),
});

test('each attempt is a point, with the change of month marked', () => {
  // Days 10 and 20 are in September, day 45 is October 15.
  const points = scoreChartPoints([attempt(1, 10, 40, false), attempt(2, 20, 65), attempt(3, 45, 85, true)]);
  assert.deepEqual(
    points.map((point) => [point.attemptNumber, point.scorePercent, point.passed, point.latest, point.newMonth]),
    [
      [1, 40, false, false, false],
      [2, 65, false, false, false],
      [3, 85, true, true, true],
    ],
  );
  assert.deepEqual(scoreChartPoints([]), []);
});

test('only the latest attempts are shown until all are asked for', () => {
  const attempts = Array.from({ length: SCORE_CHART_LATEST + 3 }, (_, index) => attempt(index + 1, 10, 50));
  const latest = scoreChartPoints(attempts);
  assert.equal(latest.length, SCORE_CHART_LATEST);
  assert.deepEqual([latest[0].attemptNumber, latest.at(-1).attemptNumber, latest.at(-1).latest], [4, 15, true]);
  assert.equal(scoreChartPoints(attempts, { all: true }).length, SCORE_CHART_LATEST + 3);
});

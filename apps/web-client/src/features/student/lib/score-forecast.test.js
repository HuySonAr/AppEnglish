import test from 'node:test';
import assert from 'node:assert/strict';
import { ForecastStatus, scoreForecast } from './score-forecast.js';

const point = (day, total) => ({ at: `2026-10-${String(day).padStart(2, '0')}T03:00:00.000Z`, total });
const goal = (targetScore, examDate = null) => ({ targetScore, examDate });

test('the forecast needs a goal, a score and two scores a few days apart', () => {
  assert.equal(scoreForecast({ goal: null, history: [point(1, 500)] }), null);
  assert.equal(scoreForecast({ goal: goal(650), history: [] }).status, ForecastStatus.NO_SCORE);
  assert.equal(scoreForecast({ goal: goal(650), history: [point(1, 500)] }).status, ForecastStatus.NEED_MORE);
  assert.equal(scoreForecast({ goal: goal(650), history: [point(1, 500), point(2, 520)] }).status, ForecastStatus.NEED_MORE);
  assert.equal(scoreForecast({ goal: goal(500), history: [point(1, 480), point(8, 510)] }).status, ForecastStatus.REACHED);
});

test('a rising line gives the day the target is reached, checked against the exam date', () => {
  const history = [point(1, 500), point(8, 535), point(15, 570)];
  const onTrack = scoreForecast({ goal: goal(650, '2027-01-31'), history });
  assert.deepEqual([onTrack.status, onTrack.perWeek, onTrack.date.slice(0, 10)], [ForecastStatus.ON_TRACK, 35, '2026-10-31']);
  assert.deepEqual(onTrack.projection.map((item) => item.total), [570, 650]);
  assert.equal(scoreForecast({ goal: goal(650, '2026-10-25'), history }).status, ForecastStatus.LATE);
  assert.equal(scoreForecast({ goal: goal(650), history: [point(1, 600), point(15, 580)] }).status, ForecastStatus.FLAT);
  assert.equal(scoreForecast({ goal: goal(990), history: [point(1, 500), point(29, 505)] }).status, ForecastStatus.FAR);
});

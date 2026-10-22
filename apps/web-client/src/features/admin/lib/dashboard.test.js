import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionItems, overallHealth, signupSummary, weeklyTrend } from './dashboard.js';

test('attention items list locked accounts and stale sign-ups with their filters', () => {
  assert.deepEqual(attentionItems({ byStatus: { ACTIVE: 5 }, stalePending: 0 }), []);
  const items = attentionItems({ byStatus: { SUSPENDED: 2, DISABLED: 1 }, stalePending: 3 });
  assert.deepEqual(items.map((item) => [item.key, item.count, item.to]), [
    ['suspended', 2, '/admin/accounts?status=SUSPENDED'],
    ['disabled', 1, '/admin/accounts?status=DISABLED'],
    ['stale', 3, '/admin/accounts?stale=true'],
  ]);
  assert.equal(items[1].label, '1 disabled account');
});

test('overall health', () => {
  assert.equal(overallHealth([]), 'unknown');
  assert.equal(overallHealth([{ status: 'ok' }, { status: 'ok' }]), 'ok');
  assert.equal(overallHealth([{ status: 'ok' }, { status: 'down' }]), 'degraded');
  assert.equal(overallHealth([{ status: 'down' }]), 'down');
});

test('weekly trend compares the last seven days with the seven before', () => {
  const points = Array.from({ length: 14 }, (_, index) => ({ day: String(index), count: index < 7 ? 1 : 2 }));
  assert.deepEqual(weeklyTrend(points), { thisWeek: 14, lastWeek: 7, delta: 7 });
  assert.deepEqual(weeklyTrend([]), { thisWeek: 0, lastWeek: 0, delta: 0 });
});

test('the sign-ups summary: total, busiest day and daily average', () => {
  const points = [{ day: '2026-10-19', count: 2 }, { day: '2026-10-20', count: 0 }, { day: '2026-10-21', count: 2 }];
  assert.deepEqual(signupSummary(points), { total: 4, peak: { day: '2026-10-21', count: 2 }, average: 1.3 });
  assert.deepEqual(signupSummary([{ day: '2026-10-21', count: 0 }]), { total: 0, peak: null, average: 0 });
  assert.deepEqual(signupSummary([]), { total: 0, peak: null, average: 0 });
});

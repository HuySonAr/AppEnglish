import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDescription, lockReasonRequired, signupSeries, statusBreakdown, timeAgo } from './accounts.js';

test('a reason is needed only when an account is locked', () => {
  assert.equal(lockReasonRequired('ACTIVE', 'SUSPENDED'), true);
  assert.equal(lockReasonRequired('ACTIVE', 'DISABLED'), true);
  assert.equal(lockReasonRequired('SUSPENDED', 'ACTIVE'), false);
  assert.equal(lockReasonRequired('SUSPENDED', 'SUSPENDED'), false);
  assert.equal(lockReasonRequired('PENDING_VERIFICATION', 'PENDING_VERIFICATION'), false);
});

test('audit rows read as sentences', () => {
  const labels = { status: { ACTIVE: 'Active', SUSPENDED: 'Suspended' }, role: { STUDENT: 'Student', ADMIN: 'Admin' } };
  assert.equal(auditDescription({ action: 'ROLE_UPDATED', previousRole: 'STUDENT', nextRole: 'ADMIN' }, labels), 'Role changed from Student to Admin');
  assert.equal(auditDescription({ action: 'STATUS_UPDATED', previousStatus: 'ACTIVE', nextStatus: 'SUSPENDED' }, labels), 'Status changed from Active to Suspended');
  assert.equal(auditDescription({ action: 'SESSIONS_REVOKED' }), 'Signed out of every device');
  assert.equal(auditDescription({ action: 'SOMETHING_NEW' }), 'SOMETHING_NEW');
});

test('the sign-up series covers every day of the window, oldest first', () => {
  const today = new Date('2026-10-19T15:00:00Z');
  const series = signupSeries([{ day: '2026-10-19', count: 2 }, { day: '2026-10-17', count: 1 }], { days: 4, today });
  assert.deepEqual(series, [
    { day: '2026-10-16', count: 0 },
    { day: '2026-10-17', count: 1 },
    { day: '2026-10-18', count: 0 },
    { day: '2026-10-19', count: 2 },
  ]);
  assert.equal(signupSeries([], { today }).length, 30);
});

test('the status breakdown keeps a fixed order with shares', () => {
  const rows = statusBreakdown({ ACTIVE: 3, SUSPENDED: 1 }, 4);
  assert.deepEqual(rows.map((row) => [row.status, row.count, row.percent]), [
    ['PENDING_VERIFICATION', 0, 0],
    ['ACTIVE', 3, 75],
    ['DISABLED', 0, 0],
    ['SUSPENDED', 1, 25],
  ]);
  assert.equal(statusBreakdown({}, 0)[1].percent, 0);
});

test('relative time', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  assert.equal(timeAgo(null, now), '');
  assert.equal(timeAgo('2026-10-19T11:59:40Z', now), 'just now');
  assert.equal(timeAgo('2026-10-19T11:30:00Z', now), '30 min ago');
  assert.equal(timeAgo('2026-10-19T09:00:00Z', now), '3 hours ago');
  assert.equal(timeAgo('2026-10-18T09:00:00Z', now), '1 day ago');
  assert.equal(timeAgo('2026-08-01T09:00:00Z', now), '2 months ago');
});

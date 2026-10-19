import { AccountStatus } from '@appenglish/auth-contracts';

// Pure rules of the admin dashboard (D115).

// What needs the admin's eye, from the account statistics: locked accounts
// and stale sign-ups, each with the filter that lists them. Empty when all is well.
export function attentionItems(stats) {
  const byStatus = stats?.byStatus || {};
  const items = [];
  const suspended = byStatus[AccountStatus.SUSPENDED] || 0;
  const disabled = byStatus[AccountStatus.DISABLED] || 0;
  const stale = stats?.stalePending || 0;
  if (suspended) items.push({ key: 'suspended', count: suspended, label: `${suspended} suspended account${suspended === 1 ? '' : 's'}`, hint: 'Temporary locks meant to be lifted', to: `/admin/accounts?status=${AccountStatus.SUSPENDED}`, tone: 'warning' });
  if (disabled) items.push({ key: 'disabled', count: disabled, label: `${disabled} disabled account${disabled === 1 ? '' : 's'}`, hint: 'Closed for good', to: `/admin/accounts?status=${AccountStatus.DISABLED}`, tone: 'destructive' });
  if (stale) items.push({ key: 'stale', count: stale, label: `${stale} stale sign-up${stale === 1 ? '' : 's'}`, hint: 'Pending verification for over 7 days', to: '/admin/accounts?stale=true', tone: 'info' });
  return items;
}

// Overall health from the service probes: ok, degraded (some down) or down (all down).
export function overallHealth(services = []) {
  if (!services.length) return 'unknown';
  const down = services.filter((service) => service.status !== 'ok').length;
  if (down === 0) return 'ok';
  return down === services.length ? 'down' : 'degraded';
}

// Sign-ups this week against the week before, from the daily series (oldest
// first): { thisWeek, lastWeek, delta } where delta is the change in count.
export function weeklyTrend(points = []) {
  const thisWeek = points.slice(-7).reduce((sum, point) => sum + point.count, 0);
  const lastWeek = points.slice(-14, -7).reduce((sum, point) => sum + point.count, 0);
  return { thisWeek, lastWeek, delta: thisWeek - lastWeek };
}

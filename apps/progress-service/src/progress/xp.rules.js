import { XP_MAX_PER_MOCK } from '@appenglish/progress-contracts';

export function xpOf(correctCount, totalCount) {
  if (!totalCount) return 0;
  return Math.max(0, Math.min(XP_MAX_PER_MOCK, Math.round((correctCount * XP_MAX_PER_MOCK) / totalCount)));
}

export const earnsXp = (payload) => payload.attemptNumber === 1;

export function rankTotals(totals) {
  return [...totals]
    .sort((a, b) => b.totalXp - a.totalXp || new Date(a.reachedAt) - new Date(b.reachedAt) || a.accountId.localeCompare(b.accountId))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function totalsOf(rows) {
  const byAccount = new Map();
  for (const row of rows) {
    const total = byAccount.get(row.accountId) || { accountId: row.accountId, accountEmail: '', totalXp: 0, reachedAt: null, mockCount: 0 };
    total.totalXp += row.xp;
    total.mockCount += 1;
    if (!total.reachedAt || new Date(row.earnedAt) > new Date(total.reachedAt)) {
      total.reachedAt = row.earnedAt;
      total.accountEmail = row.accountEmail;
    }
    byAccount.set(row.accountId, total);
  }
  return [...byAccount.values()];
}

import { XP_MAX_PER_MOCK } from '@appenglish/progress-contracts';

// Pure rules of XP and the leaderboard (D10, D39, D63, D112).

// XP of one mock test: right answers over questions, scaled to 100 and
// rounded to a whole number. Only the first full attempt earns it (D63).
export function xpOf(correctCount, totalCount) {
  if (!totalCount) return 0;
  return Math.max(0, Math.min(XP_MAX_PER_MOCK, Math.round((correctCount * XP_MAX_PER_MOCK) / totalCount)));
}

export const earnsXp = (payload) => payload.attemptNumber === 1;

// Ranks the learners' totals: more XP first; at the same XP, whoever reached
// it earlier (the time of their last gain) is ahead (D39). Ranks are 1, 2,
// 3… in that order. Each total is { accountId, accountEmail, totalXp,
// reachedAt, mockCount }.
export function rankTotals(totals) {
  return [...totals]
    .sort((a, b) => b.totalXp - a.totalXp || new Date(a.reachedAt) - new Date(b.reachedAt) || a.accountId.localeCompare(b.accountId))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// The totals of every learner from the ledger rows (used by the in-memory
// repository and tests; PostgreSQL aggregates the same in SQL).
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

import { matchesSearch } from '../../../lib/list.js';

export function filterLeaderboard(entries, { search = '' } = {}) {
  return entries.filter((entry) => matchesSearch(entry.displayName, search));
}

export function pageOfRank(rank, pageSize) {
  if (!rank || !pageSize) return 1;
  return Math.ceil(rank / pageSize);
}

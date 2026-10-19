import { matchesSearch } from '../../../lib/list.js';

// Pure rules of the leaderboard page (D39): the board arrives ranked; the
// learner only narrows it by email. Ranks stay as given, so a filtered list
// still shows each learner's real place.
export function filterLeaderboard(entries, { search = '' } = {}) {
  return entries.filter((entry) => matchesSearch(entry.email, search));
}

// The page of the board the learner's own row is on, for a jump to it.
export function pageOfRank(rank, pageSize) {
  if (!rank || !pageSize) return 1;
  return Math.ceil(rank / pageSize);
}

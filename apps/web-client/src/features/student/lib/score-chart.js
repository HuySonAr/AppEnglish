// The attempts the score chart shows before "Show all" is chosen.
export const SCORE_CHART_LATEST = 12;

const monthOf = (attempt) => {
  const date = new Date(attempt.submittedAt);
  return date.getFullYear() * 12 + date.getMonth();
};

// The points of the score chart, one per finished attempt, oldest first: the
// latest SCORE_CHART_LATEST attempts, or all of them. newMonth marks the first
// attempt shown of a later month than the one before it.
export function scoreChartPoints(attempts, { all = false } = {}) {
  const shown = all ? attempts : attempts.slice(-SCORE_CHART_LATEST);
  return shown.map((attempt, index) => ({
    attemptNumber: attempt.attemptNumber,
    scorePercent: attempt.scorePercent,
    submittedAt: attempt.submittedAt,
    passed: Boolean(attempt.passed),
    latest: index === shown.length - 1,
    newMonth: index > 0 && monthOf(attempt) !== monthOf(shown[index - 1]),
  }));
}

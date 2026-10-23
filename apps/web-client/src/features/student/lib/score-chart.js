export const SCORE_CHART_LATEST = 12;

const monthOf = (attempt) => {
  const date = new Date(attempt.submittedAt);
  return date.getFullYear() * 12 + date.getMonth();
};

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

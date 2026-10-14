import { TestReview } from './TestReview.jsx';

// One finished attempt of a mock test or mini test: its score, then the
// answers and explanations. label names the series ("Full test", "Part 5 mini
// test"); attempt and parts come from the review API.
export function MockAttemptResult({ label, attempt, parts }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {label} · attempt {attempt.attemptNumber}
        </p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-primary">{attempt.scorePercent}%</p>
        <p className="mt-1 text-muted-foreground">
          {attempt.correctCount} of {attempt.totalCount} correct
        </p>
        {attempt.estimated ? (
          <p className="mt-3 text-sm">
            Estimated score <span className="text-lg font-bold">{attempt.estimated.totalScore}</span> / 990
            {' · '}Listening {attempt.estimated.listeningScore} · Reading {attempt.estimated.readingScore}
          </p>
        ) : null}
      </div>
      <h2 className="text-lg font-semibold">Answers and explanations</h2>
      <TestReview parts={parts} />
    </div>
  );
}

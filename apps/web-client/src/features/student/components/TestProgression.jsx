import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { TestTrend } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';

const trends = {
  [TestTrend.IMPROVED]: {
    icon: TrendingUp,
    tone: 'border-success/40 bg-success/10 text-success',
    title: 'You are improving',
  },
  [TestTrend.DECLINED]: {
    icon: TrendingDown,
    tone: 'border-destructive/40 bg-destructive/10 text-destructive',
    title: 'Your last result went down',
  },
  [TestTrend.UNCHANGED]: {
    icon: Minus,
    tone: 'border-border bg-muted/50 text-muted-foreground',
    title: 'Your result stayed the same',
  },
};

const signed = (value) => (value > 0 ? `+${value}` : String(value));

function Change({ label, value }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {signed(value)}
      </p>
    </div>
  );
}

// How the learner's lesson-test results develop over the retakes: the latest
// attempt against the one before it, per skill, and against the first one.
// attempts are the finished attempts (oldest first); progression comes from
// the API and is null with fewer than two attempts.
export function TestProgression({ attempts, progression, passPercent }) {
  if (!progression) return null;
  const trend = trends[progression.trend];
  const latest = attempts.at(-1);
  const previous = attempts.at(-2);
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', trend.tone)}>
        <trend.icon className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">{trend.title}</p>
          <p className="text-sm text-foreground">
            Attempt {latest.attemptNumber}: {latest.scorePercent}% · attempt {previous.attemptNumber}:{' '}
            {previous.scorePercent}% ({signed(progression.changeFromPrevious)} right answer
            {Math.abs(progression.changeFromPrevious) === 1 ? '' : 's'})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Change label="Listening vs last time" value={progression.listeningChange} />
        <Change label="Reading vs last time" value={progression.readingChange} />
        <Change label="Total vs last time" value={progression.changeFromPrevious} />
        <Change label="Total vs first attempt" value={progression.changeFromFirst} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Score of each attempt</p>
        <ol className="flex h-32 items-end gap-2" aria-label="Score of each attempt">
          {attempts.map((attempt) => (
            <li key={attempt.attemptNumber} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold tabular-nums">{attempt.scorePercent}%</span>
              <span
                className={cn('w-full max-w-[3rem] rounded-t-md', attempt.passed ? 'bg-success' : 'bg-primary/60')}
                style={{ height: `${Math.max(4, attempt.scorePercent * 0.8)}%` }}
              />
              <span className="text-xs text-muted-foreground tabular-nums">#{attempt.attemptNumber}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Green bars reached the pass mark of {passPercent}%.
        </p>
      </div>
    </div>
  );
}

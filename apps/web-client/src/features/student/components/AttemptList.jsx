import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { formatRemaining } from '../lib/placement.js';

// Finished attempts of one test, oldest first, each with the change against
// the one before it and a button to see its answers. attempts are the
// summaries from the API; shownNumber is the attempt whose answers are open.
export function AttemptList({ attempts, shownNumber, busy, onReview }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm shadow-sm">
      {attempts.map((attempt, index) => {
        const change = index ? attempt.correctCount - attempts[index - 1].correctCount : 0;
        const shown = shownNumber === attempt.attemptNumber;
        return (
          <li
            key={attempt.attemptNumber}
            className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', shown && 'bg-primary/5')}
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                Attempt {attempt.attemptNumber}
                {attempt.countsForXp ? <Badge variant="info">Counts for XP</Badge> : null}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {new Date(attempt.submittedAt).toLocaleString()} · {formatRemaining(attempt.durationSeconds * 1000)}
                {attempt.listeningTotal ? ` · Listening ${attempt.listeningCorrect}/${attempt.listeningTotal}` : ''}
                {attempt.readingTotal ? ` · Reading ${attempt.readingCorrect}/${attempt.readingTotal}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 tabular-nums">
              {attempt.estimated ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  ≈ {attempt.estimated.totalScore}
                </span>
              ) : null}
              <span className="text-base font-bold">{attempt.scorePercent}%</span>
              {change > 0 ? (
                <span className="flex items-center text-xs font-semibold text-success">
                  <ArrowUp className="h-3.5 w-3.5" />
                  {change}
                </span>
              ) : null}
              {change < 0 ? (
                <span className="flex items-center text-xs font-semibold text-destructive">
                  <ArrowDown className="h-3.5 w-3.5" />
                  {-change}
                </span>
              ) : null}
            </div>
            <Button variant={shown ? 'secondary' : 'outline'} size="sm" disabled={busy || shown} onClick={() => onReview(attempt.attemptNumber)}>
              {shown ? 'Shown below' : 'View answers'}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

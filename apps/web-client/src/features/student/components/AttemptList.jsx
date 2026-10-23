import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { formatRemaining } from '../lib/placement.js';

function Change({ value, unit }) {
  if (!value) return null;
  const up = value > 0;
  return (
    <span className={cn('flex items-center text-xs font-semibold tabular-nums', up ? 'text-success' : 'text-destructive')}>
      {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {Math.abs(value)}
      {unit}
    </span>
  );
}

export function AttemptList({ attempts, shownNumber, busy, onReview }) {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card text-sm shadow-sm">
      {attempts.map((attempt, index) => {
        const before = attempts[index - 1];
        const shown = shownNumber === attempt.attemptNumber;
        const toeic = attempt.estimated;
        const change = before ? (toeic && before.estimated ? toeic.totalScore - before.estimated.totalScore : attempt.correctCount - before.correctCount) : 0;
        return (
          <li key={attempt.attemptNumber} className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3', shown && 'bg-primary/5')}>
            <div className="w-24 shrink-0">
              {toeic ? (
                <p className="tabular-nums">
                  <span className="text-2xl font-bold text-primary">{toeic.totalScore}</span>
                  <span className="text-xs text-muted-foreground"> /990</span>
                </p>
              ) : (
                <p className="text-2xl font-bold tabular-nums">{attempt.scorePercent}%</p>
              )}
              <Change value={change} unit={toeic && before?.estimated ? '' : ' right'} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                Attempt {attempt.attemptNumber}
                {attempt.countsForXp ? <Badge variant="info">Counts for XP</Badge> : null}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {toeic ? `Listening ${toeic.listeningScore} · Reading ${toeic.readingScore} · ` : ''}
                {attempt.correctCount}/{attempt.totalCount} correct{toeic ? ` (${attempt.scorePercent}%)` : ''} · {formatRemaining(attempt.durationSeconds * 1000)} ·{' '}
                {new Date(attempt.submittedAt).toLocaleDateString()}
              </p>
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

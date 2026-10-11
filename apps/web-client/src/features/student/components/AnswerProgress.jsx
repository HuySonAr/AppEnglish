import { cn } from '../../../lib/utils.js';

// How much of a test is answered, shown large before submitting: the count, a
// bar, and the numbers of the questions still open.
export function AnswerProgress({ answered, total, unanswered }) {
  const complete = answered === total;
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="flex items-end justify-between gap-3">
        <p>
          <span className={cn('text-4xl font-bold tabular-nums', complete ? 'text-success' : 'text-primary')}>
            {answered}
          </span>
          <span className="text-lg text-muted-foreground"> / {total} answered</span>
        </p>
        <p className={cn('text-sm font-semibold', complete ? 'text-success' : 'text-destructive')}>
          {complete ? 'All answered' : `${total - answered} not answered`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', complete ? 'bg-success' : 'bg-primary')}
          style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
        />
      </div>
      {unanswered.length ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Questions not answered (they count as wrong):</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {unanswered.map((number) => (
              <li
                key={number}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 text-sm font-semibold tabular-nums text-destructive"
              >
                {number}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

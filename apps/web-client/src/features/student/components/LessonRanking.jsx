import { Trophy } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { formatRemaining } from '../lib/placement.js';

const medals = {
  1: 'bg-amber-400 text-amber-950',
  2: 'bg-slate-300 text-slate-900',
  3: 'bg-orange-400 text-orange-950',
};

export function LessonRanking({ ranking }) {
  const rows = ranking.me && !ranking.entries.some((entry) => entry.isMe)
    ? [...ranking.entries, ranking.me]
    : ranking.entries;
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-md">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <Trophy className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold leading-tight">Lesson ranking</h2>
          <p className="text-xs text-primary-foreground/80">
            First attempt · score, then time
          </p>
        </div>
        <span className="ml-auto rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold tabular-nums">
          {ranking.total} learner{ranking.total === 1 ? '' : 's'}
        </span>
      </div>
      {ranking.me ? (
        <p className="border-b bg-primary/10 px-4 py-2 text-sm font-medium">
          You are #{ranking.me.rank} of {ranking.total}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Nobody has taken this test yet. Be the first.
        </p>
      ) : (
        <ol className="divide-y">
          {rows.map((entry) => (
            <li
              key={entry.rank}
              className={cn('flex items-center gap-3 px-4 py-2.5', entry.isMe && 'bg-primary/10')}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                  medals[entry.rank] || 'bg-muted text-muted-foreground',
                )}
              >
                {entry.rank}
              </span>
              <Avatar account={entry} size="sm" />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm', entry.isMe && 'font-semibold')}>
                  {entry.displayName || 'Learner'}
                  {entry.isMe ? ' (you)' : ''}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {entry.correctCount}/{entry.totalCount} · {formatRemaining(entry.durationSeconds * 1000)}
                </span>
              </span>
              <span className="text-base font-bold tabular-nums text-primary">{entry.scorePercent}%</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

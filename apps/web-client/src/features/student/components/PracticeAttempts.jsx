import { ChevronRight } from 'lucide-react';
import { SubmissionStatus } from '@appenglish/learning-contracts';
import { timeAgo } from '../../../lib/notifications.js';
import { cn } from '../../../lib/utils.js';
import { Badge } from '../../../components/ui';
import { scoreTone, toneText } from '../lib/practice.js';

const statusBadges = {
  [SubmissionStatus.SCORING]: { variant: 'info', label: 'Scoring' },
  [SubmissionStatus.FAILED]: { variant: 'destructive', label: 'Not scored' },
  [SubmissionStatus.SAVED]: { variant: 'outline', label: 'Saved' },
};

export function PracticeAttempts({ submissions, currentId, onOpen, maxScore = 10 }) {
  return (
    <aside className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs lg:self-start">
      <p className="font-semibold">Your attempts</p>
      {submissions.length ? (
        <ul className="-mx-2 space-y-1">
          {submissions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                  currentId === item.id && 'bg-accent',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Attempt {submissions.length - index}</span>
                  <span className="block text-xs text-muted-foreground">
                    {timeAgo(item.submittedAt)}
                    {item.note ? ` · ${item.note}` : ''}
                  </span>
                </span>
                {item.status === SubmissionStatus.DONE ? (
                  <span className={cn('font-semibold tabular-nums', toneText[scoreTone(item.total, maxScore)])}>{item.total === null || item.total === undefined ? '—' : item.total.toFixed(1)}</span>
                ) : (
                  <Badge variant={statusBadges[item.status]?.variant || 'outline-solid'}>{statusBadges[item.status]?.label || item.status}</Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No attempts yet.</p>
      )}
    </aside>
  );
}

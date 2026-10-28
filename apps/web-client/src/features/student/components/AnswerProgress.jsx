import { X } from 'lucide-react';
import {
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../../../components/ui';
import { ClipboardAlert, ClipboardCheck, DoorExit } from '../../../components/illustrations';
import { cn } from '../../../lib/utils.js';

const SHOWN = 4;

const tones = {
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  leave: 'bg-destructive/10 text-destructive',
};

export function AnswerProgress({
  title,
  description,
  note = '',
  answered = 0,
  total = 0,
  unanswered = [],
  leaving = false,
  closeDisabled = false,
}) {
  const remaining = Math.max(0, total - answered);
  const complete = total > 0 && remaining === 0;
  const percent =
    total > 0 ? Math.min(100, Math.max(0, (answered / total) * 100)) : 0;
  const shown = unanswered.slice(0, SHOWN);
  const extra = unanswered.length - shown.length;
  const tone = tones[leaving ? 'leave' : complete ? 'success' : 'warning'];
  const Art = leaving ? DoorExit : complete ? ClipboardCheck : ClipboardAlert;
  const text =
    description ||
    (complete
      ? 'Every question has an answer. Answers are final once sent.'
      : `${remaining} unanswered question${remaining === 1 ? '' : 's'} will count as wrong.`) +
    note;

  return (
    <div className="space-y-4">
      <AlertDialogCancel
        aria-label="Close"
        disabled={closeDisabled}
        className="absolute right-3 top-3 h-8 w-8 rounded-full border-0 p-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </AlertDialogCancel>

      <div className="flex items-center gap-3 pr-8">
        <span
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
            tone,
          )}
        >
          <Art className="h-10 w-10" />
        </span>
        <div className="min-w-0 space-y-0.5 text-left">
          <AlertDialogTitle className="text-base font-semibold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed">
            {text}
          </AlertDialogDescription>
        </div>
      </div>

      <div className="mx-auto space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Answered</span>
          <span className="font-semibold tabular-nums">
            {answered}
            <span className="font-normal text-muted-foreground">
              {' '}
              / {total}
            </span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Answered questions"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              complete ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {shown.length ? (
        <ul
          className="flex items-center justify-end gap-1.5"
          aria-label="Questions not answered"
        >
          {shown.map((number) => (
            <li
              key={number}
              className="flex h-8 min-w-8 items-center justify-center rounded-full bg-destructive/10 px-2 text-xs font-semibold tabular-nums text-destructive"
            >
              {number}
            </li>
          ))}
          {extra > 0 ? (
            <li className="flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold tabular-nums text-muted-foreground">
              +{extra}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

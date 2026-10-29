import { useState } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { EtsSpeakingTask, EtsWritingTask } from '@appenglish/content-contracts';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '../../../components/ui';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { ProgressBar } from '../../../components/shared/ProgressBar.jsx';
import { etsTaskLabels } from '../../../lib/practice-prompts.js';
import { cn } from '../../../lib/utils.js';
import { formatClock } from '../lib/practice.js';
import { showsQuestionText } from '../lib/sw-exam.js';
import { useExamLeaveGuard } from './TestExam.jsx';

export function ExamBar({ section, number, total, clock, lowTime = false, onLeave }) {
  return (
    <div className="sticky top-16 z-10 -mx-4 space-y-2 border-b bg-background px-4 py-3 sm:-mx-5 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border px-3 py-1.5 text-sm font-semibold">{section}</span>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          Question {number} of {total}
        </span>
        {clock !== undefined && clock !== null ? (
          <span
            role="timer"
            aria-label="Time left"
            className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums', lowTime ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}
          >
            <Clock className="h-4 w-4" />
            {formatClock(Math.ceil(clock))}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={onLeave}>
          <LogOut className="h-4 w-4" />
          Leave
        </Button>
      </div>
      <ProgressBar value={number - 1} total={total} className="h-1.5" />
    </div>
  );
}

export function useLeaveDialog(onDiscard) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  useExamLeaveGuard(() => setOpen(true));

  async function discard() {
    setPending(true);
    const done = await onDiscard();
    if (!done) setPending(false);
  }

  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave the test?</AlertDialogTitle>
          <AlertDialogDescription>This attempt and your answers so far will be deleted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Stay</AlertDialogCancel>
          <Button variant="destructive" loading={pending} onClick={discard}>
            Discard and leave
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { open: () => setOpen(true), dialog };
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Keep working', onConfirm }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TaskHeading({ item, total }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Question {item.number}
        {total ? ` of ${total}` : ''}
      </p>
      <h2 className="text-lg font-semibold">{etsTaskLabels[item.task]}</h2>
    </div>
  );
}

export function SwPrompt({ item, compact = false, showText }) {
  const picture = item.imageUrl ? <img src={item.imageUrl} alt="" className={cn('rounded-xl border', compact ? 'max-h-48' : 'max-h-80')} /> : null;
  const textShown = showText ?? showsQuestionText(item);
  if (item.task === EtsSpeakingTask.READ_ALOUD) return <p className={cn('whitespace-pre-wrap leading-relaxed', compact ? 'text-sm' : 'text-lg')}>{item.text}</p>;
  if (item.task === EtsSpeakingTask.DESCRIBE_PICTURE) return picture;
  if (item.task === EtsSpeakingTask.RESPOND_QUESTIONS || item.task === EtsSpeakingTask.RESPOND_INFO || item.task === EtsSpeakingTask.EXPRESS_OPINION)
    return (
      <div className="space-y-3">
        {item.context ? <p className="whitespace-pre-wrap rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">{item.context}</p> : null}
        {item.info ? (
          <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed">
            <PassageText text={item.info} />
          </div>
        ) : null}
        {textShown ? <p className={cn('whitespace-pre-wrap font-medium leading-relaxed', compact ? 'text-sm' : 'text-lg')}>{item.text}</p> : null}
      </div>
    );
  if (item.task === EtsWritingTask.PICTURE_SENTENCE)
    return (
      <div className="space-y-3">
        {picture}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Use these words:</span>
          {(item.keywords || []).map((word) => (
            <span key={word} className="rounded-lg border bg-primary/10 px-2.5 py-1 font-semibold text-primary">
              {word}
            </span>
          ))}
        </div>
      </div>
    );
  if (item.task === EtsWritingTask.RESPOND_EMAIL)
    return (
      <div className="space-y-3">
        <div className={cn('overflow-y-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed', compact ? 'max-h-48' : 'max-h-112')}>{item.email}</div>
        {item.instructions ? <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{item.instructions}</p> : null}
      </div>
    );
  return <p className={cn('whitespace-pre-wrap font-medium leading-relaxed', compact ? 'text-sm' : 'text-lg')}>{item.text}</p>;
}

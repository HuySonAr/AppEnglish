import { AlertCircle, Loader2 } from 'lucide-react';
import { countWords } from '../../../lib/practice-prompts.js';
import { cn } from '../../../lib/utils.js';
import { Badge } from '../../../components/ui';
import { READ_ALOUD_MAX, attemptBadgeText, attemptStatus, formatScore, itemScore } from '../lib/sw-score.js';
import { FeedbackSection } from './PracticeFeedback.jsx';

export function SpeakingAnswer({ item }) {
  if (item.recordingUrl) return <audio controls src={item.recordingUrl} className="w-full" />;
  return (
    <p className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
      {item.durationSeconds !== null && item.durationSeconds !== undefined ? 'The recording is no longer kept.' : 'No recording.'}
    </p>
  );
}

export function WritingAnswer({ item }) {
  const text = String(item.answer || '').trim();
  if (!text) return <p className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">No answer.</p>;
  const words = countWords(text);
  return (
    <div className="space-y-1.5">
      <p className="whitespace-pre-wrap rounded-xl border bg-background p-4 text-sm leading-relaxed">{text}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {words} {words === 1 ? 'word' : 'words'}
      </p>
    </div>
  );
}

export function SwStatusNotice({ tone = 'muted', icon: Icon, spin = false, title, children, action }) {
  return (
    <div
      role={tone === 'destructive' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-start gap-3 rounded-2xl border p-4 text-sm', tone === 'destructive' ? 'border-destructive/40 bg-destructive/10' : 'bg-muted/40')}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', tone === 'destructive' ? 'text-destructive' : 'text-primary', spin && 'animate-spin motion-reduce:animate-none')} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function SwItemScore({ item, reviewed = false }) {
  const shown = itemScore(item, { reviewed });
  if (shown.source === 'none') return null;
  if (shown.source === 'pending')
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        {shown.label}
      </span>
    );
  if (shown.source === 'failed')
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Not scored
      </span>
    );
  return (
    <div className="text-right">
      <p className="text-2xl font-bold tabular-nums">
        {formatScore(shown.score)}
        <span className="text-sm font-normal text-muted-foreground">/{item.maxScore}</span>
      </p>
      <p className="text-xs text-muted-foreground">{shown.source === 'teacher' ? 'Teacher' : 'AI'}</p>
    </div>
  );
}

export function SwItemDetails({ item, reviewed = false }) {
  const shown = itemScore(item, { reviewed });
  const ai = item.ai;
  const readAloud = shown.pronunciation !== null && shown.pronunciation !== undefined;
  return (
    <>
      {readAloud ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Pronunciation', shown.pronunciation],
            ['Intonation & stress', shown.intonation],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-background p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatScore(value)}
                <span className="text-xs font-normal text-muted-foreground">/{READ_ALOUD_MAX}</span>
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {shown.source === 'failed' ? <p className="text-sm text-destructive">{shown.error}</p> : null}
      {ai?.transcript ? (
        <FeedbackSection title="What we heard">
          <p className="rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed">{ai.transcript}</p>
        </FeedbackSection>
      ) : null}
      {ai?.feedback ? (
        <FeedbackSection title="AI feedback">
          <p className="text-sm leading-relaxed text-muted-foreground">{ai.feedback}</p>
        </FeedbackSection>
      ) : null}
      {ai?.note ? <p className="text-xs text-muted-foreground">{ai.note}</p> : null}
    </>
  );
}

export function SwAttemptBadge({ attempt }) {
  const status = attemptStatus(attempt);
  if (!status) return null;
  return (
    <Badge variant={status.variant} className="shrink-0 tabular-nums">
      {attemptBadgeText(status)}
    </Badge>
  );
}

import { AlertCircle, CheckCircle2, Loader2, MessageSquareText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubmissionStatus, geminiModelLabel } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';
import { scoreTone, toneBar, toneText } from '../lib/practice.js';
import { writingGroups } from '../lib/writing.js';
import { AnnotatedText, BetterVersion, CorrectionList } from './PracticeFeedback.jsx';
import { EtsScore } from './PracticeScore.jsx';

function Notice({ tone = 'muted', icon: Icon, spin = false, title, children }) {
  return (
    <div
      role={tone === 'destructive' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', tone === 'destructive' ? 'border-destructive/40 bg-destructive/10' : 'bg-muted/40')}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', tone === 'destructive' ? 'text-destructive' : 'text-primary', spin && 'animate-spin')} />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

function Scores({ scores }) {
  const tone = scoreTone(scores.total, 5);
  return (
    <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 p-4 text-center">
        <p className={cn('text-5xl font-bold tabular-nums tracking-tight', toneText[tone])}>{scores.total.toFixed(1)}</p>
        <p className="text-xs text-muted-foreground">out of 5</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {writingGroups.map((group) => {
          const value = scores[group.key];
          return (
            <div key={group.key} className="space-y-2 rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">{group.label}</p>
              <p className="text-xl font-semibold tabular-nums">
                {value.toFixed(1)}
                <span className="text-xs font-normal text-muted-foreground"> / 5</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className={cn('h-full rounded-full', toneBar[scoreTone(value, 5)])} style={{ width: `${(value / 5) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WritingResult({ submission }) {
  const { status, result } = submission;
  const errors = result?.errors || [];
  const modelLabel = result?.model ? geminiModelLabel(result.model) : 'Gemini';

  return (
    <div className="space-y-5">
      {status === SubmissionStatus.SCORING ? <Notice icon={Loader2} spin title="Gemini is scoring your text…" /> : null}
      {status === SubmissionStatus.SAVED ? (
        <Notice icon={CheckCircle2} title="Saved without a score">
          <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
            Add your Gemini key
          </Link>{' '}
          to score your next text.
        </Notice>
      ) : null}
      {status === SubmissionStatus.FAILED ? (
        <Notice tone="destructive" icon={AlertCircle} title="Could not score this text">
          {submission.error}
        </Notice>
      ) : null}

      {status === SubmissionStatus.DONE ? (
        <>
          <Scores scores={result.scores} />
          <EtsScore ets={result.ets} />
        </>
      ) : null}

      {result?.feedback ? (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="leading-relaxed">{result.feedback}</p>
        </div>
      ) : null}

      <div className={cn('grid gap-5', errors.length > 0 && 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start')}>
        <AnnotatedText title={`Your text · ${submission.words} words`} text={submission.answer} errors={errors} />
        {errors.length ? <CorrectionList errors={errors} /> : null}
      </div>
      {status === SubmissionStatus.DONE && !errors.length ? <p className="text-sm text-muted-foreground">No mistakes were marked.</p> : null}

      <BetterVersion text={result?.rewrite} />
      {status === SubmissionStatus.DONE ? <p className="text-xs text-muted-foreground">Scored by {modelLabel}; it can be wrong.</p> : null}
    </div>
  );
}

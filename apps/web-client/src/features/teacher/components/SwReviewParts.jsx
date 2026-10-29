import { useState } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EtsSpeakingTask, SwSection } from '@appenglish/content-contracts';
import { ReviewAction, TEACHER_REVIEW_LIMITS } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { SwPrompt, TaskHeading } from '../../student/components/SwExamParts.jsx';
import { SpeakingAnswer, SwItemDetails, SwItemScore, WritingAnswer } from '../../student/components/SwScoreParts.jsx';
import { formatScore } from '../../student/lib/sw-score.js';
import { completeReview } from '../api/review-api.js';
import { READ_ALOUD_MAX, initialSwValues, swActionFor, swApproxScaled, swInvalidNumbers, swPayloadItems, swRawMax, swRawTotal, swValuesChanged } from '../lib/sw-review.js';
import { reviewKindLabels } from '../lib/review.js';

function ScoreInput({ id, label, max, value, invalid, disabled, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label} (0–{max})
      </Label>
      <Input id={id} type="number" inputMode="numeric" min={0} max={max} step={1} className="w-24" value={value} aria-invalid={invalid} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ItemCard({ item, section, value, invalid, disabled, onChange }) {
  const Answer = section === SwSection.SPEAKING ? SpeakingAnswer : WritingAnswer;
  const readAloud = item.task === EtsSpeakingTask.READ_ALOUD;
  const set = (key) => (next) => onChange({ ...value, [key]: next });
  return (
    <li className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <TaskHeading item={item} />
        <SwItemScore item={item} />
      </div>
      <SwPrompt item={item} compact showText={Boolean(item.text)} />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Learner&apos;s answer</p>
        <Answer item={item} />
      </div>
      <SwItemDetails item={item} />
      <div className={cn('flex flex-wrap items-end gap-3 rounded-xl border p-3', invalid ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/30')}>
        {readAloud ? (
          <>
            <ScoreInput id={`sw-${item.number}-p`} label="Pronunciation" max={READ_ALOUD_MAX} value={value.pronunciation} invalid={invalid} disabled={disabled} onChange={set('pronunciation')} />
            <ScoreInput id={`sw-${item.number}-i`} label="Intonation & stress" max={READ_ALOUD_MAX} value={value.intonation} invalid={invalid} disabled={disabled} onChange={set('intonation')} />
          </>
        ) : (
          <ScoreInput id={`sw-${item.number}`} label="Your score" max={item.maxScore} value={value.score} invalid={invalid} disabled={disabled} onChange={set('score')} />
        )}
      </div>
    </li>
  );
}

export function SwReviewView({ reviewId, data, back, releasing, onRelease }) {
  const navigate = useNavigate();
  const { review, sw } = data;
  const [values, setValues] = useState(() => initialSwValues(sw.items));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const hasAi = Boolean(sw.ai);
  const action = swActionFor(hasAi, swValuesChanged(sw.items, values));
  const invalid = new Set(swInvalidNumbers(sw.items, values));
  const raw = swRawTotal(sw.items, values);
  const approx = swApproxScaled(sw.section, raw);
  const needsNote = action !== ReviewAction.CONFIRM && !note.trim();
  const blocked = action !== ReviewAction.CONFIRM && raw === null;
  const until = new Date(review.lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = { [ReviewAction.CONFIRM]: 'Confirm AI score', [ReviewAction.EDIT]: 'Save changes', [ReviewAction.FROM_SCRATCH]: 'Grade' }[action];

  async function finish() {
    setBusy(true);
    try {
      const body = action === ReviewAction.CONFIRM ? { action, note } : { action, items: swPayloadItems(sw.items, values), note };
      const result = (await completeReview(reviewId, body)).data;
      notify({ title: 'Review sent to the learner', description: result?.final ? `Score ${result.final.scaled} (raw ${formatScore(result.final.raw)}/${result.final.rawMax}).` : undefined });
      navigate('/teacher/reviews', { replace: true });
    } catch (error) {
      notify({ title: 'Could not save the review', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      {back}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{sw.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {reviewKindLabels[review.kind]} · attempt {sw.attemptNumber} · yours until {until}
          </p>
        </div>
        <Button variant="ghost" className="gap-1.5" loading={releasing} disabled={busy || releasing} onClick={onRelease}>
          <Undo2 className="h-4 w-4" />
          Put back
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ol className="space-y-4">
          {sw.items.map((item) => (
            <ItemCard
              key={item.number}
              item={item}
              section={sw.section}
              value={values[item.number]}
              invalid={invalid.has(item.number)}
              disabled={busy}
              onChange={(next) => setValues((current) => ({ ...current, [item.number]: next }))}
            />
          ))}
        </ol>
        <aside className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">Raw score</p>
            <span className="text-2xl font-bold tabular-nums">
              {raw === null ? '—' : formatScore(raw)}
              <span className="text-sm font-normal text-muted-foreground"> / {swRawMax(sw.section)}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {approx === null ? 'Fill in every question.' : `About ${approx} on the 0–200 scale; the final score is converted on save.`}
          </p>
          {hasAi ? (
            <p className="text-xs text-muted-foreground">
              AI gave {formatScore(sw.ai.raw)}/{sw.ai.rawMax} ({sw.ai.scaled}). Change any score you disagree with.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No AI score; grade every question.</p>
          )}
          {invalid.size && action !== ReviewAction.CONFIRM ? <p className="text-xs text-destructive">Check question {[...invalid].join(', ')}.</p> : null}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="sw-review-note">Comment for the learner{action === ReviewAction.CONFIRM ? ' (optional)' : ''}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {note.length}/{TEACHER_REVIEW_LIMITS.note}
              </span>
            </div>
            <Textarea id="sw-review-note" rows={5} maxLength={TEACHER_REVIEW_LIMITS.note} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
          </div>
          <Button className="w-full gap-1.5" loading={busy} disabled={busy || releasing || blocked || needsNote} onClick={finish}>
            <CheckCircle2 className="h-4 w-4" />
            {label}
          </Button>
          {needsNote ? <p className="text-xs text-muted-foreground">Add a comment to send your score.</p> : null}
        </aside>
      </div>
    </section>
  );
}

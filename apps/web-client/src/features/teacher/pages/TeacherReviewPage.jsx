import { useEffect, useState } from 'react';
import { CheckCircle2, Undo2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ReviewAction, TEACHER_REVIEW_LIMITS } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { taskTypeLabels } from '../../../lib/practice-prompts.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { AnnotatedText, FeedbackSection, PromptReference } from '../../student/components/PracticeFeedback.jsx';
import { completeReview, getReview, releaseReview } from '../api/review-api.js';
import { actionFor, initialScores, previewTotal, reviewKindLabels, scoresChanged } from '../lib/review.js';

function LearnerWork({ data }) {
  const { prompt, work, ai, review } = data;
  const result = ai.result;
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prompt</p>
        {review.kind === 'read_aloud' ? (
          <>
            <p className="text-lg leading-relaxed">{prompt.text}</p>
            {prompt.audioUrl ? <audio controls src={prompt.audioUrl} className="w-full" /> : null}
          </>
        ) : (
          <>
            <p className="whitespace-pre-line leading-relaxed">{prompt.instructions}</p>
            {prompt.imageUrl ? <img src={prompt.imageUrl} alt="" className="max-h-60 rounded-lg border" /> : null}
            <p className="text-sm text-muted-foreground">
              {review.kind === 'writing' ? `${taskTypeLabels[prompt.taskType] || 'Writing'} · ${prompt.minWords}–${prompt.maxWords} words` : `Up to ${prompt.maxSeconds} seconds`}
            </p>
          </>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Learner&apos;s answer</p>
        {work.recordingUrl ? <audio controls src={work.recordingUrl} className="w-full" /> : null}
        {work.answer ? <AnnotatedText title={`Text · ${work.words} words`} text={work.answer} errors={result?.errors || []} /> : null}
        {result?.transcript ? <AnnotatedText title="What Whisper heard" text={result.transcript} errors={result.gemini?.errors || []} /> : null}
        {review.kind === 'read_aloud' && result?.words ? (
          <FeedbackSection title="Words heard">
            <p className="leading-loose">
              {result.words.map((word, index) => (
                <span key={index} className={word.status === 'missing' ? 'text-destructive line-through' : word.status === 'mispronounced' ? 'underline decoration-warning decoration-wavy' : ''}>
                  {word.text}{' '}
                </span>
              ))}
            </p>
          </FeedbackSection>
        ) : null}
        {result?.feedback || result?.gemini?.feedback ? (
          <FeedbackSection title="AI feedback">
            <p className="text-sm leading-relaxed text-muted-foreground">{result.feedback || result.gemini.feedback}</p>
          </FeedbackSection>
        ) : null}
        {ai.status === 'FAILED' ? <p className="text-sm text-muted-foreground">AI could not score it: {ai.error}</p> : null}
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <PromptReference sampleAnswer={prompt.sampleAnswer} keyPoints={prompt.keyPoints} />
        {!prompt.sampleAnswer && !prompt.keyPoints.length ? <p className="text-sm text-muted-foreground">This prompt has no sample answer.</p> : null}
      </div>
    </div>
  );
}

export function TeacherReviewPage() {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);

  async function load() {
    setState('loading');
    try {
      const next = (await getReview(reviewId)).data;
      setData(next);
      setScores(initialScores(next.criteria, next.ai.scores));
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not open this answer', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [reviewId]);

  async function finish(action) {
    setBusy(action);
    try {
      await completeReview(reviewId, { action, scores: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Number(value)])), note });
      notify({ title: 'Review sent to the learner' });
      navigate('/teacher/reviews', { replace: true });
    } catch (error) {
      notify({ title: 'Could not save the review', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(null);
    }
  }

  async function release() {
    setBusy('release');
    try {
      await releaseReview(reviewId);
      navigate('/teacher/reviews', { replace: true });
    } catch (error) {
      notify({ title: 'Could not put it back', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(null);
    }
  }

  const back = <PageBreadcrumb items={[{ label: 'Grading', to: '/teacher/reviews' }, data ? { label: data.prompt.title } : null]} />;
  if (state === 'loading') return <DetailPageSkeleton aside />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/teacher/reviews">
          Back to the queue
        </Link>
      </div>
    );

  const ai = data.ai.scores;
  const changed = scoresChanged(data.criteria, ai, scores);
  const action = actionFor(ai, changed);
  const total = previewTotal(data.review.kind, data.criteria, scores);
  const needsNote = action !== ReviewAction.CONFIRM && !note.trim();
  const until = new Date(data.review.lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <section className="space-y-5">
      {back}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{data.prompt.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">{data.prompt.level}</Badge>
            <span>{reviewKindLabels[data.review.kind]}</span>
            <span>· yours until {until}</span>
          </div>
        </div>
        <Button variant="ghost" className="gap-1.5" loading={busy === 'release'} disabled={Boolean(busy)} onClick={release}>
          <Undo2 className="h-4 w-4" />
          Put back
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <LearnerWork data={data} />
        <aside className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">Your score</p>
            <span className="text-2xl font-bold tabular-nums">
              {total === null ? '—' : total.toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground"> / {data.maxScore}</span>
            </span>
          </div>
          {ai ? <p className="text-xs text-muted-foreground">AI gave {ai.total.toFixed(1)}. Change any score you disagree with.</p> : <p className="text-xs text-muted-foreground">No AI score; grade every part.</p>}
          <div className="grid grid-cols-2 gap-3">
            {data.criteria.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <Label htmlFor={`score-${item.key}`} className="text-xs">
                  {item.label} ({item.min}–{item.max})
                </Label>
                <Input
                  id={`score-${item.key}`}
                  type="number"
                  inputMode="decimal"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={scores[item.key]}
                  onChange={(event) => setScores((value) => ({ ...value, [item.key]: event.target.value }))}
                  disabled={Boolean(busy)}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="review-note">Comment for the learner{action === ReviewAction.CONFIRM ? ' (optional)' : ''}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {note.length}/{TEACHER_REVIEW_LIMITS.note}
              </span>
            </div>
            <Textarea id="review-note" rows={5} maxLength={TEACHER_REVIEW_LIMITS.note} value={note} onChange={(event) => setNote(event.target.value)} disabled={Boolean(busy)} />
          </div>
          <Button className="w-full gap-1.5" loading={busy === action} disabled={Boolean(busy) || total === null || needsNote} onClick={() => finish(action)}>
            <CheckCircle2 className="h-4 w-4" />
            {action === ReviewAction.CONFIRM ? 'Confirm the AI score' : 'Send my score'}
          </Button>
          {needsNote ? <p className="text-xs text-muted-foreground">Add a comment to send a new score.</p> : null}
        </aside>
      </div>
    </section>
  );
}

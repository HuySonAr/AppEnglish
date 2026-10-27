import { useEffect, useState } from 'react';
import { Check, ClipboardList, KeyRound, Lock, PenLine, Play, Send } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { countWords } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { durationText, etsTaskLabel, levelLabel, taskTypeLabels } from '../../../lib/practice-prompts.js';
import { Badge, Button } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getWritingPrompt, getWritingSubmission, submitWriting } from '../api/writing-api.js';
import { PracticeTabs, ResultCard } from '../components/PracticeTabs.jsx';
import { TeacherReviewPanel } from '../components/TeacherReviewPanel.jsx';
import { WritingResult } from '../components/WritingResult.jsx';
import { useSubmission } from '../hooks/use-submission.js';
import { WordMeter } from '../components/WordMeter.jsx';
import { wordRangeState, writingGroups } from '../lib/writing.js';
import { Countdown, TimerSwitch, TimingBadges } from '../components/EtsTimer.jsx';
import { useCountdown } from '../hooks/use-recorder.js';
import { useNoTimer } from '../hooks/use-no-timer.js';
import { hasTimer, writingLocked } from '../lib/ets-practice.js';
import { formatClock } from '../lib/practice.js';

const draftKey = (promptId) => `writing-draft:${promptId}`;
const readDraft = (promptId) => {
  try {
    return window.localStorage.getItem(draftKey(promptId)) || '';
  } catch {
    return '';
  }
};
const writeDraft = (promptId, text) => {
  try {
    if (text) window.localStorage.setItem(draftKey(promptId), text);
    else window.localStorage.removeItem(draftKey(promptId));
  } catch {
    return;
  }
};

export function WritingPromptPage() {
  const { promptId } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [noTimer, setNoTimerValue] = useNoTimer();
  const timed = Boolean(data && hasTimer(data.prompt) && data.prompt.timing.writeSeconds && !noTimer);
  const writeSeconds = data?.prompt?.timing?.writeSeconds || 0;
  const left = useCountdown(writeSeconds, timed && started, () => {});
  const setNoTimer = (value) => {
    setNoTimerValue(value);
    setStarted(false);
  };
  const refresh = async () => setData((await getWritingPrompt(promptId)).data);
  const latest = useSubmission(getWritingSubmission, { onSettled: () => refresh().catch(() => {}) });
  const viewing = useSubmission(getWritingSubmission, { onSettled: () => refresh().catch(() => {}) });
  const tab = params.get('tab') === 'history' ? 'history' : 'practice';

  function showAttempt(id) {
    viewing.open(id);
    setParams({ tab: 'history', submission: id }, { replace: true });
  }

  async function load() {
    setState('loading');
    try {
      await refresh();
      setState('ready');
      const wanted = params.get('submission');
      if (wanted) showAttempt(wanted);
    } catch (error) {
      setState(error?.response?.status === 404 ? 'missing' : 'error');
      if (error?.response?.status !== 404) notify({ title: 'Could not load the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    latest.setSubmission(null);
    viewing.setSubmission(null);
    setText(typeof window === 'undefined' ? '' : readDraft(promptId));
    setStarted(false);
    load();
  }, [promptId]);

  function change(value) {
    setText(value);
    writeDraft(promptId, value);
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { submission } = (await submitWriting(promptId, text)).data;
      latest.setSubmission(submission);
      change('');
      setStarted(false);
      refresh().catch(() => {});
    } catch (error) {
      notify({ title: 'Could not submit your text', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function reviewed(target, { review, quota }) {
    for (const holder of [latest, viewing]) if (holder.submission?.id === target.id) holder.setSubmission((value) => ({ ...value, review }));
    setData((value) => ({ ...value, reviewQuota: quota }));
  }

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Writing', to: '/student/practice/writing' }, data ? { label: data.prompt.title } : null]} />;
  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'missing')
    return (
      <section className="space-y-6">
        {back}
        <EmptyState icon={PenLine} title="Prompt not available" description="Choose another prompt." />
      </section>
    );
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const { prompt, submissions, hasKey } = data;
  const words = countWords(text);
  const fit = wordRangeState(words, prompt.minWords, prompt.maxWords);
  const current = latest.submission;
  const typeLabel = etsTaskLabel(prompt.etsTask, taskTypeLabels[prompt.taskType] || 'Writing');
  const locked = writingLocked(prompt, timed, started ? left : null);
  const waiting = timed && !started;
  const recommended = prompt.timing?.recommendedWords;

  const practice = (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardList className="h-4 w-4" />
              </span>
              <p className="font-semibold">Your task</p>
            </div>
            <p className="whitespace-pre-line text-[15px] leading-7">{prompt.instructions}</p>
            {prompt.imageUrl ? <img src={prompt.imageUrl} alt="" className="w-full rounded-xl border object-cover" /> : null}
            {prompt.etsTask === 'picture_sentence' && prompt.keywords?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Use these words</p>
                <div className="flex flex-wrap gap-1.5">
                  {prompt.keywords.map((word) => (
                    <span key={word} className="rounded-lg border bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {prompt.etsTask === 'respond_email' && prompt.email ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
                <p className="whitespace-pre-line rounded-xl border bg-background p-4 text-sm leading-6">{prompt.email}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{typeLabel}</Badge>
              <Badge variant="outline">
                {prompt.minWords}–{prompt.maxWords} words
              </Badge>
              <Badge variant="outline">{levelLabel(prompt.level)}</Badge>
            </div>
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scored on</p>
              <div className="flex flex-wrap gap-1.5">
                {writingGroups.map((group) => (
                  <span key={group.key} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {group.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {!hasKey ? (
            <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                Without a key your text is only saved.{' '}
                <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
                  Add your Gemini key
                </Link>
              </p>
            </div>
          ) : null}
        </aside>

        <form className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/30" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <label htmlFor="writing-text" className="font-semibold">
              Your text
            </label>
            {timed && started ? (
              <span className={`flex items-center gap-1.5 text-sm font-semibold tabular-nums ${locked ? 'text-destructive' : left <= 60 ? 'text-warning' : 'text-primary'}`} role="timer">
                {locked ? <Lock className="h-3.5 w-3.5" /> : null}
                {locked ? 'Time is up' : formatClock(Math.ceil(left))}
              </span>
            ) : text ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-success" />
                Draft kept on this device
              </span>
            ) : null}
          </div>
          {waiting ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 px-5 py-8 text-center">
              <Countdown label="Time to write" left={writeSeconds} total={writeSeconds} />
              <Button size="lg" className="gap-2" onClick={() => setStarted(true)}>
                <Play className="h-4 w-4" />
                Start writing
              </Button>
              <p className="text-sm text-muted-foreground">You have {durationText(writeSeconds)}.</p>
            </div>
          ) : (
          <Textarea
            id="writing-text"
            value={text}
            onChange={(event) => change(event.target.value)}
            disabled={submitting}
            readOnly={locked}
            autoFocus={timed && started}
            placeholder="Start writing here…"
            spellCheck
            className="min-h-[22rem] resize-y rounded-none border-0 bg-transparent px-5 py-4 text-base leading-7 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          )}
          {locked ? <p className="border-t bg-destructive/10 px-5 py-2 text-sm">Time is up. Submit your text.</p> : null}
          <div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-1">
              <WordMeter words={words} min={prompt.minWords} max={prompt.maxWords} />
              {recommended ? <p className="text-xs text-muted-foreground">Aim for {recommended}+ words.</p> : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              {text && !locked ? (
                <Button type="button" variant="ghost" disabled={submitting} onClick={() => change('')}>
                  Clear
                </Button>
              ) : null}
              <Button type="submit" className="gap-2" loading={submitting} disabled={fit !== 'ok' || waiting}>
                <Send className="h-4 w-4" />
                {hasKey ? 'Submit for scoring' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {current ? (
        <div className="space-y-4">
          <ResultCard submission={current} title="Your latest result">
            <WritingResult submission={current} />
          </ResultCard>
          <TeacherReviewPanel submission={current} quota={data.reviewQuota} onRequested={(answer) => reviewed(current, answer)} />
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="space-y-6">
      {back}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{levelLabel(prompt.level)}</Badge>
          <span>
            {typeLabel} · {prompt.topic}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{prompt.title}</h1>
        {hasTimer(prompt) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {timed ? <TimingBadges task={prompt.etsTask} /> : <span />}
            <TimerSwitch checked={noTimer} onChange={setNoTimer} />
          </div>
        ) : null}
      </div>

      <PracticeTabs
        tab={tab}
        onTab={(next) => setParams(next === 'history' ? { tab: 'history', ...(viewing.submission ? { submission: viewing.submission.id } : {}) } : {}, { replace: true })}
        practiceLabel="Write"
        practice={practice}
        submissions={submissions}
        viewing={viewing.submission}
        onOpen={showAttempt}
        renderResult={(submission) => <WritingResult submission={submission} />}
        quota={data.reviewQuota}
        onReview={reviewed}
        maxScore={5}
      />
    </section>
  );
}

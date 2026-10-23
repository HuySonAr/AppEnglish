import { useEffect, useState } from 'react';
import { KeyRound, PenLine, Send } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { countWords } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { timeAgo } from '../../../lib/notifications.js';
import { taskTypeLabels } from '../../../lib/practice-prompts.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getWritingPrompt, getWritingSubmission, submitWriting } from '../api/writing-api.js';
import { PracticeAttempts } from '../components/PracticeAttempts.jsx';
import { WritingResult } from '../components/WritingResult.jsx';
import { SCORING_POLL_LIMIT, SCORING_POLL_MS, isScoring } from '../lib/practice.js';
import { wordRangeState } from '../lib/writing.js';

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
const counterTones = { empty: 'text-muted-foreground', short: 'text-warning', long: 'text-destructive', ok: 'text-success' };

export function WritingPromptPage() {
  const { promptId } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [current, setCurrent] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setData((await getWritingPrompt(promptId)).data);
  }

  async function open(submissionId) {
    try {
      setCurrent((await getWritingSubmission(submissionId)).data.submission);
    } catch (error) {
      notify({ title: 'Could not open that attempt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  async function load() {
    setState('loading');
    try {
      await refresh();
      setState('ready');
      const wanted = params.get('submission');
      if (wanted) open(wanted);
    } catch (error) {
      setState(error?.response?.status === 404 ? 'missing' : 'error');
      if (error?.response?.status !== 404) notify({ title: 'Could not load the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    setCurrent(null);
    setText(typeof window === 'undefined' ? '' : readDraft(promptId));
    load();
  }, [promptId]);

  useEffect(() => {
    if (!isScoring(current)) return undefined;
    let tries = 0;
    let cancelled = false;
    let timer;
    const poll = async () => {
      tries++;
      try {
        const next = (await getWritingSubmission(current.id)).data.submission;
        if (cancelled) return;
        if (!isScoring(next)) {
          setCurrent(next);
          refresh().catch(() => {});
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (tries < SCORING_POLL_LIMIT) timer = setTimeout(poll, SCORING_POLL_MS);
    };
    timer = setTimeout(poll, SCORING_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [current?.id, current?.status]);

  function change(value) {
    setText(value);
    writeDraft(promptId, value);
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { submission } = (await submitWriting(promptId, text)).data;
      setCurrent(submission);
      setParams({ submission: submission.id }, { replace: true });
      change('');
      refresh().catch(() => {});
    } catch (error) {
      notify({ title: 'Could not submit your text', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Writing', to: '/student/practice/writing' }, data ? { label: data.prompt.title } : null]} />;
  if (state === 'loading') return <DetailPageSkeleton aside />;
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

  return (
    <section className="space-y-6">
      {back}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{prompt.level}</Badge>
          <span>
            {taskTypeLabels[prompt.taskType] || 'Writing'} · {prompt.topic}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{prompt.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task</p>
            <p className="whitespace-pre-line leading-relaxed">{prompt.instructions}</p>
            {prompt.imageUrl ? <img src={prompt.imageUrl} alt="" className="max-h-72 rounded-lg border" /> : null}
            <p className="text-sm text-muted-foreground">
              {prompt.minWords}–{prompt.maxWords} words
            </p>
          </div>

          <form className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm" onSubmit={submit}>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="writing-text" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your text
              </label>
              <span className={cn('text-sm tabular-nums', counterTones[fit])}>
                {words} / {prompt.minWords}–{prompt.maxWords} words
              </span>
            </div>
            <Textarea id="writing-text" rows={10} value={text} onChange={(event) => change(event.target.value)} disabled={submitting} placeholder="Start writing here" />
            {!hasKey ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="h-4 w-4" />
                <span>
                  Without a key your text is only saved.{' '}
                  <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
                    Add your Gemini key
                  </Link>
                </span>
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" className="gap-2" loading={submitting} disabled={fit !== 'ok'}>
                <Send className="h-4 w-4" />
                {hasKey ? 'Submit for scoring' : 'Save'}
              </Button>
            </div>
          </form>

          {current ? (
            <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Result</p>
                <span className="text-xs text-muted-foreground">{timeAgo(current.submittedAt)}</span>
              </div>
              <WritingResult submission={current} />
            </div>
          ) : null}
        </div>

        <PracticeAttempts
          submissions={submissions}
          currentId={current?.id}
          maxScore={5}
          onOpen={(id) => {
            open(id);
            setParams({ submission: id }, { replace: true });
          }}
        />
      </div>
    </section>
  );
}

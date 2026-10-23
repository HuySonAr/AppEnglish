import { useEffect, useState } from 'react';
import { KeyRound, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { kindLabels } from '../../../lib/practice-prompts.js';
import { useParams, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { timeAgo } from '../../../lib/notifications.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getSpeakingPrompt, getSpeakingSubmission, submitSpeaking } from '../api/speaking-api.js';
import { SpeakingRecorder } from '../components/SpeakingRecorder.jsx';
import { SpeakingResult } from '../components/SpeakingResult.jsx';
import { SCORING_POLL_LIMIT, SCORING_POLL_MS, isScoring } from '../lib/practice.js';
import { PracticeAttempts } from '../components/PracticeAttempts.jsx';

export function SpeakingPromptPage() {
  const { promptId } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [current, setCurrent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);

  async function refresh() {
    setData((await getSpeakingPrompt(promptId)).data);
  }

  async function open(submissionId) {
    try {
      setCurrent((await getSpeakingSubmission(submissionId)).data.submission);
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
        const next = (await getSpeakingSubmission(current.id)).data.submission;
        if (cancelled) return;
        if (!isScoring(next)) {
          setCurrent(next);
          refresh().catch(() => {});
          return;
        }
        if (next.stage !== current.stage) {
          setCurrent(next);
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
  }, [current?.id, current?.status, current?.stage]);

  async function submit(take) {
    setSubmitting(true);
    try {
      const { submission } = (await submitSpeaking(promptId, take)).data;
      setCurrent(submission);
      setParams({ submission: submission.id }, { replace: true });
      setRecorderKey((key) => key + 1);
      refresh().catch(() => {});
    } catch (error) {
      notify({ title: 'Could not submit the recording', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Speaking', to: '/student/practice/speaking' }, data ? { label: data.prompt.title } : null]} />;
  if (state === 'loading') return <DetailPageSkeleton aside />;
  if (state === 'missing')
    return (
      <section className="space-y-6">
        {back}
        <EmptyState icon={Mic} title="Prompt not available" description="Choose another prompt." />
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
  const openTask = prompt.kind === 'open_speaking';

  return (
    <section className="space-y-6">
      {back}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{prompt.level}</Badge>
          <span>
            {kindLabels[prompt.kind]} · {prompt.topic}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{prompt.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          {openTask ? (
            <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task</p>
              <p className="whitespace-pre-line text-lg leading-relaxed">{prompt.instructions}</p>
              {prompt.imageUrl ? <img src={prompt.imageUrl} alt="" className="max-h-72 rounded-lg border" /> : null}
              <p className="text-sm text-muted-foreground">Speak for up to {prompt.maxSeconds} seconds.</p>
              {!hasKey ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                  <span>
                    Without a key you get the transcript, fluency and pronunciation.{' '}
                    <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
                      Add your Gemini key
                    </Link>
                  </span>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Read this aloud</p>
              <p className="text-xl leading-relaxed sm:text-2xl">{prompt.text}</p>
              {prompt.audioUrl ? <audio controls src={prompt.audioUrl} className="w-full" /> : null}
            </div>
          )}

          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your recording</p>
            <SpeakingRecorder key={recorderKey} maxSeconds={prompt.maxSeconds} submitting={submitting} onSubmit={submit} />
          </div>

          {current ? (
            <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Result</p>
                <span className="text-xs text-muted-foreground">{timeAgo(current.submittedAt)}</span>
              </div>
              <SpeakingResult submission={current} />
            </div>
          ) : null}
        </div>

        <PracticeAttempts
          submissions={submissions}
          currentId={current?.id}
          onOpen={(id) => {
            open(id);
            setParams({ submission: id }, { replace: true });
          }}
        />
      </div>
    </section>
  );
}

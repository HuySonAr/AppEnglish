import { useEffect, useState } from 'react';
import { KeyRound, Mic } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { kindLabels } from '../../../lib/practice-prompts.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getSpeakingPrompt, getSpeakingSubmission, submitSpeaking } from '../api/speaking-api.js';
import { PracticeTabs, ResultCard } from '../components/PracticeTabs.jsx';
import { SpeakingRecorder } from '../components/SpeakingRecorder.jsx';
import { SpeakingResult } from '../components/SpeakingResult.jsx';
import { TeacherReviewPanel } from '../components/TeacherReviewPanel.jsx';
import { useSubmission } from '../hooks/use-submission.js';

export function SpeakingPromptPage() {
  const { promptId } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const refresh = async () => setData((await getSpeakingPrompt(promptId)).data);
  const latest = useSubmission(getSpeakingSubmission, { onSettled: () => refresh().catch(() => {}) });
  const viewing = useSubmission(getSpeakingSubmission, { onSettled: () => refresh().catch(() => {}) });
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
    load();
  }, [promptId]);

  async function submit(take) {
    setSubmitting(true);
    try {
      const { submission } = (await submitSpeaking(promptId, take)).data;
      latest.setSubmission(submission);
      setRecorderKey((key) => key + 1);
      refresh().catch(() => {});
    } catch (error) {
      notify({ title: 'Could not submit the recording', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function reviewed(target, { review, quota }) {
    for (const holder of [latest, viewing]) if (holder.submission?.id === target.id) holder.setSubmission((value) => ({ ...value, review }));
    setData((value) => ({ ...value, reviewQuota: quota }));
  }

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Speaking', to: '/student/practice/speaking' }, data ? { label: data.prompt.title } : null]} />;
  if (state === 'loading') return <DetailPageSkeleton />;
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
  const current = latest.submission;

  const practice = (
    <div className="mx-auto max-w-3xl space-y-6">
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
        <>
          <ResultCard submission={current} title="Your latest result">
            <SpeakingResult submission={current} />
          </ResultCard>
          <TeacherReviewPanel submission={current} quota={data.reviewQuota} onRequested={(answer) => reviewed(current, answer)} />
        </>
      ) : null}
    </div>
  );

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

      <PracticeTabs
        tab={tab}
        onTab={(next) => setParams(next === 'history' ? { tab: 'history', ...(viewing.submission ? { submission: viewing.submission.id } : {}) } : {}, { replace: true })}
        practiceLabel={openTask ? 'Speak' : 'Read aloud'}
        practice={practice}
        submissions={submissions}
        viewing={viewing.submission}
        onOpen={showAttempt}
        renderResult={(submission) => <SpeakingResult submission={submission} />}
        quota={data.reviewQuota}
        onReview={reviewed}
      />
    </section>
  );
}

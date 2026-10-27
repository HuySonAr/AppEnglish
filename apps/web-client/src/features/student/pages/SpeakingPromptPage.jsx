import { useEffect, useState } from 'react';
import { KeyRound, Mic } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { etsTaskLabel, kindLabels } from '../../../lib/practice-prompts.js';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getSpeakingPrompt, getSpeakingSubmission, submitSpeaking } from '../api/speaking-api.js';
import { SetResults, SpeakingSet, TimedSpeakingTask } from '../components/EtsSpeaking.jsx';
import { TimerSwitch, TimingBadges } from '../components/EtsTimer.jsx';
import { PracticeAttempts } from '../components/PracticeAttempts.jsx';
import { useNoTimer } from '../hooks/use-no-timer.js';
import { useSubmissionGroup } from '../hooks/use-submission-group.js';
import { groupBySet, hasTimer, isSetPrompt } from '../lib/ets-practice.js';
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
  const latestSet = useSubmissionGroup(getSpeakingSubmission, { onSettled: () => refresh().catch(() => {}) });
  const viewingSet = useSubmissionGroup(getSpeakingSubmission, { onSettled: () => refresh().catch(() => {}) });
  const [noTimer, setNoTimer] = useNoTimer();
  const tab = params.get('tab') === 'history' ? 'history' : 'practice';

  function showSet(id, list) {
    const group = groupBySet(list || data?.submissions || []).find((item) => item.id === id);
    if (group) viewingSet.openMany(group.answers.map((answer) => answer.id));
    setParams({ tab: 'history', set: id }, { replace: true });
  }

  function showAttempt(id) {
    viewing.open(id);
    setParams({ tab: 'history', submission: id }, { replace: true });
  }

  async function load() {
    setState('loading');
    try {
      const result = (await getSpeakingPrompt(promptId)).data;
      setData(result);
      setState('ready');
      const wanted = params.get('submission');
      const wantedSet = params.get('set');
      if (wantedSet) showSet(wantedSet, result.submissions);
      else if (wanted) showAttempt(wanted);
    } catch (error) {
      setState(error?.response?.status === 404 ? 'missing' : 'error');
      if (error?.response?.status !== 404) notify({ title: 'Could not load the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    latest.setSubmission(null);
    viewing.setSubmission(null);
    latestSet.setItems([]);
    viewingSet.setItems([]);
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

  async function submitAnswer(take, questionIndex, setId) {
    const { submission } = (await submitSpeaking(promptId, { ...take, questionIndex, setId })).data;
    latestSet.setItems((items) => [...items.filter((item) => item.setId === setId), submission]);
    refresh().catch(() => {});
    return submission;
  }

  function reviewed(target, { review, quota }) {
    for (const holder of [latest, viewing]) if (holder.submission?.id === target.id) holder.setSubmission((value) => ({ ...value, review }));
    for (const group of [latestSet, viewingSet]) group.update(target.id, (value) => ({ ...value, review }));
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
  const setTask = isSetPrompt(prompt);
  const timed = hasTimer(prompt) && !noTimer;
  const current = latest.submission;
  const groups = setTask ? groupBySet(submissions) : [];
  const selectedSet = params.get('set');
  const byQuestion = (a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0);

  const keyNote =
    !hasKey && openTask ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <KeyRound className="h-4 w-4" />
        <span>
          Without a key you get the transcript, fluency and pronunciation.{' '}
          <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
            Add your Gemini key
          </Link>
        </span>
      </p>
    ) : null;

  const task = setTask ? (
    <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task</p>
      {prompt.instructions ? <p className="whitespace-pre-line leading-relaxed">{prompt.instructions}</p> : null}
      {prompt.context ? <p className="whitespace-pre-line text-lg leading-relaxed">{prompt.context}</p> : null}
      {prompt.info ? (
        <div className="rounded-xl border bg-background p-4 text-sm">
          <PassageText text={prompt.info} />
        </div>
      ) : null}
      {keyNote}
    </div>
  ) : openTask ? (
    <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task</p>
      <p className="whitespace-pre-line text-lg leading-relaxed">{prompt.instructions}</p>
      {prompt.imageUrl ? <img src={prompt.imageUrl} alt="" className="max-h-72 rounded-lg border" /> : null}
      {!timed ? <p className="text-sm text-muted-foreground">Speak for up to {prompt.maxSeconds} seconds.</p> : null}
      {keyNote}
    </div>
  ) : (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Read this aloud</p>
      <p className="text-xl leading-relaxed sm:text-2xl">{prompt.text}</p>
      {prompt.audioUrl ? <audio controls src={prompt.audioUrl} className="w-full" /> : null}
    </div>
  );

  const practice = (
    <div className="mx-auto max-w-3xl space-y-6">
      {task}

      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{setTask ? 'Your answers' : 'Your recording'}</p>
        {setTask ? (
          <SpeakingSet key={`${recorderKey}-${timed}`} prompt={prompt} timed={timed} onSubmitAnswer={submitAnswer} />
        ) : timed ? (
          <TimedSpeakingTask key={`${recorderKey}-timed`} prompt={prompt} submitting={submitting} onSubmit={submit} />
        ) : (
          <SpeakingRecorder key={recorderKey} maxSeconds={prompt.maxSeconds} submitting={submitting} onSubmit={submit} />
        )}
      </div>

      {setTask && latestSet.items.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your latest results</p>
          <SetResults answers={[...latestSet.items].sort(byQuestion)} questions={prompt.questions} quota={data.reviewQuota} onReview={reviewed} />
        </div>
      ) : null}

      {!setTask && current ? (
        <>
          <ResultCard submission={current} title="Your latest result">
            <SpeakingResult submission={current} />
          </ResultCard>
          <TeacherReviewPanel submission={current} quota={data.reviewQuota} onRequested={(answer) => reviewed(current, answer)} />
        </>
      ) : null}
    </div>
  );

  const setHistory = setTask ? (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PracticeAttempts
        submissions={groups.map((group) => ({ id: group.id, submittedAt: group.submittedAt, status: group.status, total: group.total, note: `${group.answers.length} of 3 answers` }))}
        currentId={selectedSet}
        onOpen={(id) => showSet(id)}
      />
      <div className="space-y-4">
        {selectedSet && viewingSet.items.length ? (
          <SetResults answers={[...viewingSet.items].sort(byQuestion)} questions={prompt.questions} quota={data.reviewQuota} onReview={reviewed} />
        ) : (
          <EmptyState icon={Mic} title="Choose an attempt" description="Pick one on the left to see its answers." />
        )}
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-6">
      {back}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{prompt.level}</Badge>
          <span>
            {etsTaskLabel(prompt.etsTask, kindLabels[prompt.kind])} · {prompt.topic}
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
        onTab={(next) => setParams(next === 'history' ? { tab: 'history', ...(setTask ? (selectedSet ? { set: selectedSet } : {}) : viewing.submission ? { submission: viewing.submission.id } : {}) } : {}, { replace: true })}
        practiceLabel={openTask ? 'Speak' : 'Read aloud'}
        history={setHistory}
        historyCount={setTask ? groups.length : undefined}
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

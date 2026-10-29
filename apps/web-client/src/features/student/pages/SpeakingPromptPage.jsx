import { useEffect, useState } from 'react';
import { ArrowLeft, History, KeyRound, Mic, Trash2, X } from 'lucide-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_OUT } from '../../../lib/motion.js';
import { RevealGroup, RevealItem } from '../../../components/shared/Reveal.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  etsTaskLabel,
  kindLabels,
  levelLabel,
  speakingPartOf,
} from '../../../lib/practice-prompts.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import {
  deleteSpeakingSubmission,
  getSpeakingPrompt,
  getSpeakingSubmission,
  submitSpeaking,
} from '../api/speaking-api.js';
import { ConfirmDelete } from '../components/ConfirmDelete.jsx';
import {
  SetResults,
  SpeakingSet,
  TimedSpeakingTask,
} from '../components/EtsSpeaking.jsx';
import { TimerSwitch } from '../components/EtsTimer.jsx';
import { SpeakingTaskCard } from '../components/SpeakingTaskCard.jsx';
import { PracticeAttempts } from '../components/PracticeAttempts.jsx';
import { useNoTimer } from '../hooks/use-no-timer.js';
import { useSubmissionGroup } from '../hooks/use-submission-group.js';
import {
  groupBySet,
  hasTimer,
  isSetPrompt,
  recordSeconds,
} from '../lib/ets-practice.js';
import { PracticeHistory } from '../components/PracticeTabs.jsx';
import { SpeakingRecorder } from '../components/SpeakingRecorder.jsx';
import { SpeakingResult } from '../components/SpeakingResult.jsx';
import { SpeakingResultScreen } from '../components/SpeakingResultScreen.jsx';
import { useSubmission } from '../hooks/use-submission.js';
import { ChevronLeft } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

export function SpeakingPromptPage({ view = 'practice' }) {
  const { promptId } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [deleting, setDeleting] = useState(null);
  const [data, setData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const refresh = async () => setData((await getSpeakingPrompt(promptId)).data);
  const latest = useSubmission(getSpeakingSubmission, {
    onSettled: () => refresh().catch(() => {}),
  });
  const viewing = useSubmission(getSpeakingSubmission, {
    onSettled: () => refresh().catch(() => {}),
  });
  const latestSet = useSubmissionGroup(getSpeakingSubmission, {
    onSettled: () => refresh().catch(() => {}),
  });
  const viewingSet = useSubmissionGroup(getSpeakingSubmission, {
    onSettled: () => refresh().catch(() => {}),
  });
  const [noTimer, setNoTimer] = useNoTimer();
  const historyView = view === 'history';
  const resultId = params.get('result');
  const resultSet = params.get('resultSet');

  function showSet(id, list) {
    const group = groupBySet(list || data?.submissions || []).find(
      (item) => item.id === id,
    );
    if (group) viewingSet.openMany(group.answers.map((answer) => answer.id));
    setParams({ set: id }, { replace: true });
  }

  async function removeAttempt() {
    try {
      await deleteSpeakingSubmission(deleting.id);
      notify({
        title: deleting.set
          ? 'Attempt deleted (all three answers)'
          : 'Attempt deleted',
      });
      viewing.setSubmission(null);
      viewingSet.setItems([]);
      setParams({}, { replace: true });
      setDeleting(null);
      await refresh();
    } catch (error) {
      notify({
        title: 'Could not delete the attempt',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  function showAttempt(id) {
    viewing.open(id);
    setParams({ submission: id }, { replace: true });
  }

  async function load() {
    setState('loading');
    try {
      const result = (await getSpeakingPrompt(promptId)).data;
      setData(result);
      setState('ready');
      const wanted = params.get('submission');
      const wantedSet = params.get('set');
      if (historyView) {
        if (wantedSet) showSet(wantedSet, result.submissions);
        else if (wanted) showAttempt(wanted);
      } else if (resultSet) {
        const group = groupBySet(result.submissions).find(
          (item) => item.id === resultSet,
        );
        if (group) latestSet.openMany(group.answers.map((answer) => answer.id));
      } else if (resultId) latest.open(resultId);
    } catch (error) {
      setState(error?.response?.status === 404 ? 'missing' : 'error');
      if (error?.response?.status !== 404)
        notify({
          title: 'Could not load the prompt',
          description: getApiErrorMessage(error),
          variant: 'destructive',
        });
    }
  }

  useEffect(() => {
    latest.setSubmission(null);
    viewing.setSubmission(null);
    latestSet.setItems([]);
    viewingSet.setItems([]);
    load();
  }, [promptId, view]);

  async function submit(take) {
    setSubmitting(true);
    try {
      const { submission } = (await submitSpeaking(promptId, take)).data;
      latest.setSubmission(submission);
      setRecorderKey((key) => key + 1);
      setParams({ result: submission.id });
      refresh().catch(() => {});
    } catch (error) {
      notify({
        title: 'Could not submit the recording',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer(take, questionIndex, setId) {
    const { submission } = (
      await submitSpeaking(promptId, { ...take, questionIndex, setId })
    ).data;
    latestSet.setItems((items) => [
      ...items.filter((item) => item.setId === setId),
      submission,
    ]);
    refresh().catch(() => {});
    return submission;
  }

  function practiseAgain() {
    latest.setSubmission(null);
    latestSet.setItems([]);
    setRecorderKey((key) => key + 1);
    setParams({});
  }

  function reviewed(target, { review, quota }) {
    for (const holder of [latest, viewing])
      if (holder.submission?.id === target.id)
        holder.setSubmission((value) => ({ ...value, review }));
    for (const group of [latestSet, viewingSet])
      group.update(target.id, (value) => ({ ...value, review }));
    setData((value) => ({ ...value, reviewQuota: quota }));
  }

  const promptPart = data ? speakingPartOf(data.prompt) : null;
  if (!historyView && params.get('tab') === 'history') {
    const keep = new URLSearchParams(params);
    keep.delete('tab');
    return (
      <Navigate
        to={`/student/practice/speaking/${promptId}/history${keep.toString() ? `?${keep}` : ''}`}
        replace
      />
    );
  }
  const listPath = promptPart
    ? `/student/practice/speaking?part=${promptPart.number}`
    : '/student/practice/speaking';
  const partCrumb = promptPart
    ? { label: `Part ${promptPart.number}`, to: listPath }
    : null;
  const back = (
    <PageBreadcrumb
      items={[
        { label: 'Practice', to: '/student/practice' },
        { label: 'Speaking', to: listPath },
        partCrumb,
        data ? { label: data.prompt.title } : null,
      ]}
    />
  );
  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'missing')
    return (
      <section className="space-y-6">
        {back}
        <EmptyState
          icon={Mic}
          title="Prompt not available"
          description="Choose another prompt."
        />
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
          <Link
            to="/student/gemini-key"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Add your Gemini key
          </Link>
        </span>
      </p>
    ) : null;

  const startLabel = setTask
    ? `Start ${promptPart?.questions?.toLowerCase() || 'the questions'}`
    : `Start question ${promptPart?.firstQuestion || 1}`;
  const practice = (
    <RevealGroup className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <RevealItem className="rounded-xl border bg-card p-4 sm:p-5">
        <SpeakingTaskCard prompt={prompt} part={promptPart} />
      </RevealItem>

      <RevealItem className="space-y-3 lg:sticky lg:top-20">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${recorderKey}-${timed}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {setTask ? (
                <SpeakingSet
                  prompt={prompt}
                  timed={timed}
                  startLabel={startLabel}
                  firstQuestion={promptPart?.firstQuestion || 1}
                  onSubmitAnswer={submitAnswer}
                  onFinished={(setId) => setParams({ resultSet: setId })}
                />
              ) : timed ? (
                <TimedSpeakingTask
                  prompt={prompt}
                  submitting={submitting}
                  startLabel={startLabel}
                  onSubmit={submit}
                />
              ) : (
                <SpeakingRecorder
                  maxSeconds={recordSeconds(prompt, 0)}
                  submitting={submitting}
                  startLabel={startLabel}
                  onSubmit={submit}
                />
              )}
            </motion.div>
          </AnimatePresence>
          {hasTimer(prompt) ? (
            <div className="flex justify-center border-t pt-3">
              <TimerSwitch checked={noTimer} onChange={setNoTimer} />
            </div>
          ) : null}
          {keyNote}
        </div>
      </RevealItem>
    </RevealGroup>
  );

  const setHistory = setTask ? (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PracticeAttempts
        submissions={groups.map((group) => ({
          id: group.id,
          submittedAt: group.submittedAt,
          status: group.status,
          total: group.total,
          note: `${group.answers.length} of 3 answers`,
        }))}
        currentId={selectedSet}
        onOpen={(id) => showSet(id)}
      />
      <div className="space-y-4">
        {selectedSet && viewingSet.items.length ? (
          <>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setDeleting({ id: viewingSet.items[0].id, set: true })
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete this attempt
              </Button>
            </div>
            <SetResults
              hasKey={hasKey}
              answers={[...viewingSet.items].sort(byQuestion)}
              questions={prompt.questions}
              quota={data.reviewQuota}
              onReview={reviewed}
            />
          </>
        ) : (
          <EmptyState
            icon={Mic}
            title="Choose an attempt"
            description="Pick one on the left to see its answers."
          />
        )}
      </div>
    </div>
  ) : null;

  const historyPath = `/student/practice/speaking/${promptId}/history`;
  const attemptCount = setTask ? groups.length : submissions.length;
  const toolbar = (
    <div className="space-y-2">
      <PageBreadcrumb
        items={[
          { label: 'Practice', to: '/student/practice' },
          { label: 'Speaking', to: listPath },
          partCrumb,
          historyView ? { label: 'Your attempts' } : null,
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {historyView ? (
              <h1 className="mr-1 text-lg font-semibold tracking-tight text-foreground">
                Your attempts
              </h1>
            ) : null}
            <Badge variant="secondary">{levelLabel(prompt.level)}</Badge>
            <span className="truncate hidden sm:inline">
              {etsTaskLabel(prompt.etsTask, kindLabels[prompt.kind])}
              {prompt.topic ? ` · ${prompt.topic}` : ''}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {historyView ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={`/student/practice/speaking/${promptId}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to practice
              </Link>
            </Button>
          ) : attemptCount ? (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to={historyPath}>
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Your attempts ({attemptCount})
                </span>
              </Link>
            </Button>
          ) : null}
          {historyView ? null : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="bg-primary text-white transition-colors hover:bg-primary/90 hover:text-white/90 rounded-full sm:rounded-md p-0 h-auto"
            >
              <Link
                to={listPath}
                aria-label={
                  promptPart ? `Exit to Part ${promptPart.number}` : 'Exit'
                }
                className="flex items-center gap-1 p-2"
              >
                <span className="hidden sm:inline text-sm">Back</span>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (resultId || resultSet) {
    const answers = resultSet
      ? latestSet.items.filter((item) => item.setId === resultSet)
      : current?.id === resultId
        ? [current]
        : [];
    return (
      <section className="space-y-4">
        {toolbar}
        <SpeakingResultScreen
          answers={answers}
          setTask={Boolean(resultSet)}
          questions={prompt.questions || []}
          hasKey={hasKey}
          quota={data.reviewQuota}
          onReview={reviewed}
          onAgain={practiseAgain}
          listPath={listPath}
        />
      </section>
    );
  }

  const confirm = (
    <ConfirmDelete
      open={Boolean(deleting)}
      title="Delete this attempt?"
      description={
        deleting?.set
          ? 'All three answers and their recordings are deleted for good.'
          : 'The answer, its score and its recording are deleted for good.'
      }
      onOpenChange={(open) => !open && setDeleting(null)}
      onConfirm={removeAttempt}
    />
  );

  if (historyView)
    return (
      <section className="space-y-5">
        {toolbar}
        {submissions.length ? (
          <PracticeHistory
            submissions={submissions}
            viewing={viewing.submission}
            onOpen={showAttempt}
            renderResult={(submission) => (
              <SpeakingResult submission={submission} hasKey={hasKey} />
            )}
            quota={data.reviewQuota}
            onReview={reviewed}
            history={setHistory}
            onDelete={(submission) =>
              setDeleting({ id: submission.id, set: false })
            }
          />
        ) : (
          <EmptyState
            icon={Mic}
            title="No attempts yet"
            description="Your attempts appear here after you submit."
          />
        )}
        {confirm}
      </section>
    );

  return (
    <section className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        {toolbar}
      </motion.div>
      {practice}
    </section>
  );
}

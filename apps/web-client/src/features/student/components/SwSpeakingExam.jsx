import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mic, RotateCcw, Send, SkipForward } from 'lucide-react';
import { SwSection } from '@appenglish/content-contracts';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { Button } from '../../../components/ui';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { canRecord, useCountdown, useRecorder } from '../hooks/use-recorder.js';
import { SpeakingStep, nextOpenIndex, speakingPlan } from '../lib/sw-exam.js';
import { saveSwRecording, skipSwQuestion, submitSwAttempt } from '../api/sw-test-api.js';
import { QuestionAudio } from './EtsSpeaking.jsx';
import { Countdown } from './EtsTimer.jsx';
import { NoRecorder } from './SpeakingRecorder.jsx';
import { ExamBar, SwPrompt, TaskHeading, useLeaveDialog } from './SwExamParts.jsx';

const CHECK_SECONDS = 3;

export function MicCheck({ starting, onStart, onCancel }) {
  const recorder = useRecorder();
  const empty = recorder.take && !recorder.take.blob.size;

  if (!canRecord())
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <NoRecorder />
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-3xl border bg-card p-6 shadow-xs sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mic className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Check your microphone</h1>
          <p className="text-sm text-muted-foreground">Record {CHECK_SECONDS} seconds, then play it back.</p>
        </div>
      </div>

      {recorder.phase === 'recording' ? (
        <Countdown label="Say something" left={Math.max(0, CHECK_SECONDS - recorder.elapsed)} total={CHECK_SECONDS} tone="warning" />
      ) : recorder.take && !empty ? (
        <audio controls autoPlay src={recorder.take.url} className="w-full" />
      ) : empty ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          No sound was recorded. Check the microphone and try again.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant={recorder.take && !empty ? 'outline-solid' : 'default'} className="gap-2" disabled={recorder.phase === 'recording' || starting} onClick={() => recorder.start(CHECK_SECONDS)}>
          {recorder.take ? <RotateCcw className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {recorder.take ? 'Record again' : `Record ${CHECK_SECONDS} seconds`}
        </Button>
        {recorder.take && !empty ? (
          <Button className="gap-2" loading={starting} onClick={onStart}>
            <CheckCircle2 className="h-4 w-4" />
            Sound is fine, start
          </Button>
        ) : null}
        <Button variant="ghost" className="ml-auto" disabled={starting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function StepTimer({ label, seconds, onDone }) {
  const left = useCountdown(seconds, true, onDone);
  return <Countdown label={label} left={left} total={seconds} />;
}

function RecordStep({ seconds, onTake, onNoAnswer }) {
  const settled = useRef(false);
  const started = useRef(false);
  const settle = (handler) => (value) => {
    if (settled.current) return;
    settled.current = true;
    handler(value);
  };
  const recorder = useRecorder({ onTake: (take) => (take.blob.size ? settle(onTake)(take) : settle(onNoAnswer)()) });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    recorder.start(seconds).then((ok) => {
      if (!ok) settle(onNoAnswer)();
    });
  }, []);

  if (recorder.phase === 'recording') return <Countdown label="Speak now" left={Math.max(0, seconds - recorder.elapsed)} total={seconds} tone="warning" />;
  return <p className="text-center text-sm text-muted-foreground">Starting the recording…</p>;
}

function SpeakingQuestion({ item, total, pending, onTake, onNoAnswer, onRetry, onSkip }) {
  const [plan] = useState(() => speakingPlan(item));
  const [step, setStep] = useState(0);
  const current = plan[Math.min(step, plan.length - 1)];
  const next = () => setStep((value) => Math.min(value + 1, plan.length - 1));

  let panel = null;
  if (pending?.status === 'sending') panel = <p className="text-center text-sm text-muted-foreground">Saving your answer…</p>;
  else if (pending?.status === 'failed')
    panel = (
      <div className="space-y-3 text-center">
        <p className="text-sm text-destructive">Your answer was not saved.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="gap-2" onClick={onRetry}>
            <Send className="h-4 w-4" />
            Send again
          </Button>
          <Button variant="outline" className="gap-2" onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            Skip question
          </Button>
        </div>
      </div>
    );
  else if (current.kind === SpeakingStep.READ) panel = <StepTimer key={step} label="Read the information" seconds={current.seconds} onDone={next} />;
  else if (current.kind === SpeakingStep.LISTEN) panel = <QuestionAudio key={step} url={item.audioUrl} times={current.times} onFinished={next} />;
  else if (current.kind === SpeakingStep.PREPARE) panel = <StepTimer key={step} label="Prepare" seconds={current.seconds} onDone={next} />;
  else panel = <RecordStep key={step} seconds={current.seconds} onTake={onTake} onNoAnswer={onNoAnswer} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-xs sm:p-6">
        <TaskHeading item={item} total={total} />
        <SwPrompt item={item} />
      </div>
      <div className="rounded-3xl border bg-card p-5 shadow-xs sm:p-6">{panel}</div>
    </div>
  );
}

export function SwSpeakingExam({ testId, attempt, onDone, onExpired, onDiscard }) {
  const items = attempt.items;
  const [index, setIndex] = useState(() => nextOpenIndex(items, attempt.lockedThrough));
  const [pending, setPending] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const finished = useRef(false);
  const leave = useLeaveDialog(onDiscard);
  const expired = (error) => errorCode(error) === LearningResponseCode.SW_ATTEMPT_NOT_IN_PROGRESS;

  async function finish() {
    if (finished.current) return;
    finished.current = true;
    setFinishing('sending');
    try {
      onDone((await submitSwAttempt(testId, SwSection.SPEAKING)).data);
    } catch (error) {
      if (expired(error)) return onExpired();
      finished.current = false;
      setFinishing('failed');
      notify({ title: 'Could not submit the test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  function advance() {
    setPending(null);
    const next = indexRef.current + 1;
    if (next >= items.length) finish();
    else setIndex(next);
  }

  useEffect(() => {
    if (index >= items.length) finish();
  }, []);

  async function send(take) {
    const number = items[indexRef.current].number;
    setPending({ status: 'sending', take });
    try {
      await saveSwRecording(testId, { questionNumber: number, blob: take.blob, durationSeconds: take.durationSeconds });
      advance();
    } catch (error) {
      if (errorCode(error) === LearningResponseCode.SW_ANSWER_LOCKED) return advance();
      if (expired(error)) return onExpired();
      setPending({ status: 'failed', take });
      notify({ title: 'Could not save your answer', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  async function skip() {
    const number = items[indexRef.current].number;
    setPending({ status: 'sending', take: null });
    try {
      await skipSwQuestion(testId, number);
    } catch (error) {
      if (expired(error)) return onExpired();
    }
    advance();
  }

  const item = items[Math.min(index, items.length - 1)];

  return (
    <section className="space-y-6">
      <ExamBar section="Speaking" number={Math.min(index + 1, items.length)} total={items.length} onLeave={leave.open} />
      {finishing ? (
        <div className="mx-auto max-w-xl space-y-4 rounded-3xl border bg-card p-6 text-center shadow-xs">
          <p className="font-medium">{finishing === 'failed' ? 'The test was not submitted.' : 'Submitting your test…'}</p>
          {finishing === 'failed' ? (
            <Button onClick={finish}>Try again</Button>
          ) : null}
        </div>
      ) : (
        <SpeakingQuestion
          key={item.number}
          item={item}
          total={items.length}
          pending={pending}
          onTake={send}
          onNoAnswer={skip}
          onRetry={() => send(pending.take)}
          onSkip={skip}
        />
      )}
      {leave.dialog}
    </section>
  );
}

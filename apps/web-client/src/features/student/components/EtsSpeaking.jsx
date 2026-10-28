import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Play, RotateCcw, Send, Volume2 } from 'lucide-react';
import { ETS_SET_QUESTIONS } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { canRecord, useCountdown, useRecorder } from '../hooks/use-recorder.js';
import { newSetId, nextSetStep, playCount, prepareSeconds, readSeconds, recordSeconds, setTotal } from '../lib/ets-practice.js';
import { scoreTone, toneText } from '../lib/practice.js';
import { cn } from '../../../lib/utils.js';
import { ModelAudio } from './ModelAudio.jsx';
import { Countdown } from './EtsTimer.jsx';
import { NoRecorder, RecordingMeter, SpeakingRecorder, StartButton } from './SpeakingRecorder.jsx';
import { SpeakingResult } from './SpeakingResult.jsx';
import { TeacherReviewPanel } from './TeacherReviewPanel.jsx';

export function TimedSpeakingTask({ prompt, submitting, onSubmit, startLabel = 'Start' }) {
  const [phase, setPhase] = useState('idle');
  const prepare = prepareSeconds(prompt);
  const speak = recordSeconds(prompt, 0, true);
  const recorder = useRecorder();
  const startRecording = async () => {
    if (await recorder.start(speak)) setPhase('recording');
    else setPhase('idle');
  };
  const left = useCountdown(prepare, phase === 'prepare', startRecording);

  async function begin() {
    if (!(await recorder.openMic())) return;
    if (prepare) setPhase('prepare');
    else startRecording();
  }

  if (!canRecord()) return <NoRecorder />;

  if (phase === 'prepare')
    return (
      <Countdown label="Prepare" left={left} total={prepare}>
        <Button variant="outline" size="sm" onClick={startRecording}>
          Start speaking now
        </Button>
      </Countdown>
    );

  if (recorder.phase === 'recording') return <RecordingMeter label="Speak now" elapsed={recorder.elapsed} limit={speak} onStop={recorder.stop} />;

  if (recorder.phase === 'recorded' && recorder.take)
    return (
      <div className="space-y-4">
        <audio controls src={recorder.take.url} className="w-full" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={submitting}
            onClick={() => {
              recorder.reset();
              setPhase('idle');
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Button className="gap-2" loading={submitting} onClick={() => onSubmit({ blob: recorder.take.blob, durationSeconds: recorder.take.durationSeconds })}>
            <Send className="h-4 w-4" />
            Submit
          </Button>
        </div>
      </div>
    );

  return <StartButton label={startLabel} hint={`Prepare ${prepare} seconds · speak ${speak} seconds`} onClick={begin} />;
}

export function QuestionAudio({ url, times, onFinished }) {
  const audio = useRef(null);
  const played = useRef(0);
  const [blocked, setBlocked] = useState(false);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  function play() {
    const element = audio.current;
    if (!element) return;
    element.currentTime = 0;
    element
      .play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  }

  useEffect(() => {
    played.current = 0;
    if (!url) {
      finished.current();
      return undefined;
    }
    play();
    return () => audio.current?.pause();
  }, [url]);

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      {url ? (
        <audio
          ref={audio}
          src={url}
          preload="auto"
          className="hidden"
          onEnded={() => {
            played.current++;
            if (played.current < times) play();
            else finished.current();
          }}
        />
      ) : null}
      {blocked ? (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={play}>
          <Play className="h-4 w-4" />
          Play the question
        </Button>
      ) : (
        <>
          <Volume2 className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
          Listen{times > 1 ? ` (played ${times} times)` : ''}
        </>
      )}
    </div>
  );
}

export function SpeakingSet({ prompt, timed, onSubmitAnswer, onFinished, startLabel = 'Start' }) {
  const [setId, setSetId] = useState(() => newSetId());
  const [phase, setPhase] = useState('intro');
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [failedTake, setFailedTake] = useState(null);
  const question = prompt.questions[index];
  const speak = recordSeconds(prompt, index, timed);
  const prepare = prepareSeconds(prompt);
  const read = readSeconds(prompt);

  async function send(take) {
    setSending(true);
    setFailedTake(null);
    try {
      await onSubmitAnswer({ blob: take.blob, durationSeconds: take.durationSeconds }, index, setId);
      const next = nextSetStep(index);
      setIndex(next.index);
      setPhase(next.phase);
      recorder.reset();
      if (next.phase === 'done') onFinished?.(setId);
    } catch (error) {
      setFailedTake(take);
      setPhase('failed');
      notify({ title: 'Could not submit the answer', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  const recorder = useRecorder({ onTake: (take) => (timed ? send(take) : null) });
  const startRecording = async () => {
    if (await recorder.start(speak)) setPhase('recording');
  };
  const readLeft = useCountdown(read, phase === 'reading', () => setPhase('question'));
  const prepareLeft = useCountdown(prepare, phase === 'prepare', startRecording);

  async function begin() {
    if (timed && !(await recorder.openMic())) return;
    setIndex(0);
    setPhase(timed && read ? 'reading' : 'question');
  }

  function again() {
    recorder.reset();
    setSetId(newSetId());
    setIndex(0);
    setPhase('intro');
  }

  if (!canRecord()) return <NoRecorder />;

  if (phase === 'intro')
    return <StartButton label={startLabel} hint={timed ? `Answer ${ETS_SET_QUESTIONS} questions in a row` : `Record an answer to each of the ${ETS_SET_QUESTIONS} questions`} onClick={begin} />;

  if (phase === 'reading')
    return (
      <Countdown label="Read the information" left={readLeft} total={read}>
        <Button variant="outline" size="sm" onClick={() => setPhase('question')}>
          I am ready
        </Button>
      </Countdown>
    );

  if (phase === 'done')
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <p className="font-medium">All {ETS_SET_QUESTIONS} answers sent.</p>
        <Button variant="outline" className="gap-2" onClick={again}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Question {index + 1} of {ETS_SET_QUESTIONS}
        </p>
        <p className="text-lg font-medium leading-relaxed">{question.text}</p>
      </div>
      {timed && phase === 'question' ? <QuestionAudio key={`${setId}-${index}`} url={question.audioUrl} times={playCount(prompt, index)} onFinished={() => setPhase(prepare ? 'prepare' : 'recording-start')} /> : null}
      {!timed && question.audioUrl ? <ModelAudio key={`${setId}-${index}`} src={question.audioUrl} label={`Question ${index + 1}`} /> : null}
      {timed && phase === 'prepare' ? <Countdown label="Prepare" left={prepareLeft} total={prepare} /> : null}
      {timed && phase === 'recording-start' ? <AutoStart onStart={startRecording} /> : null}
      {timed && recorder.phase === 'recording' ? <RecordingMeter label="Speak now" elapsed={recorder.elapsed} limit={speak} onStop={recorder.stop} /> : null}
      {timed && sending ? <p className="text-center text-sm text-muted-foreground">Sending your answer…</p> : null}
      {phase === 'failed' && failedTake ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="gap-2" loading={sending} onClick={() => send(failedTake)}>
            <Send className="h-4 w-4" />
            Send again
          </Button>
        </div>
      ) : null}
      {!timed && phase !== 'failed' ? (
        <SpeakingRecorder key={`${setId}-${index}`} maxSeconds={speak} submitting={sending} submitLabel={index + 1 < ETS_SET_QUESTIONS ? 'Submit and continue' : 'Submit answer'} onSubmit={send} />
      ) : null}
    </div>
  );
}

function AutoStart({ onStart }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onStart();
  }, []);
  return null;
}

export function SetResults({ answers, questions = [], quota, onReview, hasKey }) {
  const total = setTotal(answers);
  return (
    <div className="space-y-4">
      {total !== null ? (
        <p className="text-sm text-muted-foreground">
          Average <span className={cn('text-base font-semibold tabular-nums', toneText[scoreTone(total)])}>{total.toFixed(1)}/10</span>
        </p>
      ) : null}
      {answers.map((answer) => {
        const number = (answer.questionIndex ?? 0) + 1;
        return (
          <div key={answer.id} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question {number}</p>
              <p className="font-medium">{answer.prompt?.question || questions[number - 1]?.text || ''}</p>
            </div>
            <SpeakingResult submission={answer} hasKey={hasKey} />
            <TeacherReviewPanel submission={answer} quota={quota} onRequested={(result) => onReview(answer, result)} />
          </div>
        );
      })}
    </div>
  );
}

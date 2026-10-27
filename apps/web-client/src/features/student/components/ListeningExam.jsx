import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Clock, Headphones, ListChecks, LogOut, Play } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { answerSeconds, listeningClosed, listeningItems, resumeIndex } from '../lib/mock-exam.js';
import { Question, useExamLeaveGuard } from './TestExam.jsx';

const STALL_MS = 20000;
const Stage = Object.freeze({ INTRO: 'intro', PLAYING: 'playing', ANSWERING: 'answering', FINISHING: 'finishing', FAILED: 'failed' });

export function ListeningExam({ attempt, title, saveAnswers, onFinish, onDiscard }) {
  const items = useMemo(() => listeningItems(attempt.parts), [attempt.parts]);
  const start = resumeIndex(attempt.listeningPosition, items.length);
  const [stage, setStage] = useState(Stage.INTRO);
  const [index, setIndex] = useState(start);
  const [answers, setAnswers] = useState(attempt.answers || {});
  const [progress, setProgress] = useState(0);
  const [left, setLeft] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [offset] = useState(() => new Date(attempt.serverNow).getTime() - Date.now());
  const audioRef = useRef(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const indexRef = useRef(index);
  indexRef.current = index;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const deadlineRef = useRef(0);
  const heardRef = useRef(0);
  const finishing = useRef(false);

  useExamLeaveGuard(() => setLeaving(true));

  const item = items[index];
  const questionCount = items.reduce((sum, entry) => sum + entry.questions.length, 0);
  const answered = items.flatMap((entry) => entry.questions).filter((question) => answers[question.id]).length;

  function save(nextAnswers, position) {
    return saveAnswers(nextAnswers, position).catch(() => {});
  }

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    stageRef.current = Stage.FINISHING;
    audioRef.current?.pause();
    setStage(Stage.FINISHING);
    try {
      await save(answersRef.current, items.length);
      await onFinish();
    } catch {
      finishing.current = false;
      setStage(Stage.FAILED);
    }
  }

  function startAnswering() {
    stageRef.current = Stage.ANSWERING;
    const current = items[indexRef.current];
    const seconds = answerSeconds(current);
    deadlineRef.current = Date.now() + seconds * 1000;
    setLeft(seconds);
    setStage(Stage.ANSWERING);
  }

  function failAudio() {
    if (stageRef.current !== Stage.PLAYING) return;
    setAudioError(true);
    startAnswering();
    audioRef.current?.pause();
  }

  function playItem(next) {
    const entry = items[next];
    const audio = audioRef.current;
    setProgress(0);
    setAudioError(false);
    setBlocked(false);
    heardRef.current = Date.now();
    stageRef.current = Stage.PLAYING;
    setStage(Stage.PLAYING);
    if (!entry.audioUrl || !audio) {
      failAudio();
      return;
    }
    audio.src = entry.audioUrl;
    const playing = audio.play();
    if (playing?.catch)
      playing.catch((error) => {
        if (error?.name === 'NotAllowedError') setBlocked(true);
        else if (error?.name !== 'AbortError') failAudio();
      });
  }

  function begin() {
    if (start >= items.length) {
      finish();
      return;
    }
    playItem(indexRef.current);
  }

  function advance() {
    const next = indexRef.current + 1;
    save(answersRef.current, next);
    if (next >= items.length) {
      finish();
      return;
    }
    indexRef.current = next;
    setIndex(next);
    playItem(next);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (stage !== Stage.ANSWERING) return undefined;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0 && stageRef.current === Stage.ANSWERING) {
        clearInterval(timer);
        advance();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [stage, index]);

  useEffect(() => {
    if (stage !== Stage.PLAYING || blocked) return undefined;
    const timer = setInterval(() => {
      if (Date.now() - heardRef.current > STALL_MS) failAudio();
    }, 1000);
    return () => clearInterval(timer);
  }, [stage, index, blocked]);

  useEffect(() => {
    if (!attempt.listeningClosesAt) return undefined;
    const check = () => {
      if (listeningClosed(attempt.listeningClosesAt, offset)) finish();
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [attempt.listeningClosesAt, offset]);

  useEffect(() => {
    if (answers === attempt.answers) return undefined;
    const timer = setTimeout(() => save(answers, indexRef.current), 800);
    return () => clearTimeout(timer);
  }, [answers]);

  useEffect(() => () => audioRef.current?.pause(), []);

  function onTimeUpdate(event) {
    const audio = event.currentTarget;
    heardRef.current = Date.now();
    if (audio.duration && Number.isFinite(audio.duration)) setProgress(Math.min(1, audio.currentTime / audio.duration));
  }

  function onPause(event) {
    const audio = event.currentTarget;
    if (stageRef.current === Stage.PLAYING && !finishing.current && !audio.ended) audio.play().catch(() => {});
  }

  function onEnded() {
    if (stageRef.current !== Stage.PLAYING) return;
    setProgress(1);
    startAnswering();
  }

  function playBlocked() {
    setBlocked(false);
    heardRef.current = Date.now();
    audioRef.current?.play().catch(() => failAudio());
  }

  async function discard() {
    finishing.current = true;
    setDiscarding(true);
    audioRef.current?.pause();
    const done = await onDiscard();
    if (!done) {
      finishing.current = false;
      setDiscarding(false);
    }
  }

  const choose = (questionId, optionId) => {
    if (stageRef.current !== Stage.PLAYING && stageRef.current !== Stage.ANSWERING) return;
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  };

  const audio = (
    <audio
      ref={audioRef}
      preload="auto"
      className="hidden"
      onTimeUpdate={onTimeUpdate}
      onPlaying={() => (heardRef.current = Date.now())}
      onPause={onPause}
      onEnded={onEnded}
      onError={() => failAudio()}
    />
  );

  const exitButton = (
    <Button variant="outline" disabled={discarding} onClick={() => setLeaving(true)}>
      <LogOut className="h-4 w-4" />
      Exit
    </Button>
  );

  const leaveDialog = (
    <AlertDialog open={leaving} onOpenChange={(open) => !discarding && setLeaving(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave the test?</AlertDialogTitle>
          <AlertDialogDescription>Your answers will be thrown away and the attempt will not count.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap gap-y-2">
          <AlertDialogCancel disabled={discarding}>Keep listening</AlertDialogCancel>
          <Button variant="destructive" loading={discarding} disabled={discarding} onClick={discard}>
            Discard and leave
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (stage === Stage.INTRO || stage === Stage.FINISHING || stage === Stage.FAILED) {
    const resuming = start > 0;
    return (
      <section className="space-y-6">
        {audio}
        <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Headphones className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">{title || 'Full test'}</p>
              <h1 className="text-2xl font-bold tracking-tight">Listening</h1>
              <p className="text-sm text-muted-foreground">Each recording plays once; answer before the next one starts.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-background p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Headphones className="h-3.5 w-3.5" />
                Recordings
              </p>
              <p className="text-2xl font-bold tabular-nums">{resuming ? `${Math.min(start + 1, items.length)} / ${items.length}` : items.length}</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" />
                Questions
              </p>
              <p className="text-2xl font-bold tabular-nums">{questionCount}</p>
            </div>
          </div>
          {stage === Stage.FAILED ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Could not open Reading.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {stage === Stage.INTRO ? (
              <Button size="lg" className="gap-2" onClick={begin}>
                <Play className="h-4 w-4" />
                {start >= items.length ? 'Go to Reading' : resuming ? 'Continue Listening' : 'Start Listening'}
              </Button>
            ) : (
              <Button size="lg" loading={stage === Stage.FINISHING} disabled={stage === Stage.FINISHING} onClick={finish}>
                {stage === Stage.FINISHING ? 'Opening Reading…' : 'Try again'}
              </Button>
            )}
            {exitButton}
          </div>
        </div>
        {leaveDialog}
      </section>
    );
  }

  const seconds = answerSeconds(item);
  return (
    <section className="space-y-6">
      {audio}
      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <span className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          <Headphones className="h-4 w-4" />
          Listening
        </span>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          Recording {index + 1} of {items.length}
        </span>
        <span className="text-sm font-medium tabular-nums">
          <span className="font-bold text-primary">{answered}</span>/{questionCount} answered
        </span>
        <div className="ml-auto">{exitButton}</div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">{item.partNumber}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Part {item.partNumber}</p>
            <h2 className="truncate text-xl font-bold">{item.partTitle}</h2>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm" aria-live="polite">
          {stage === Stage.PLAYING ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Headphones className="h-4 w-4 text-primary" />
                  {blocked ? 'Tap Play to hear the recording.' : 'Listen.'}
                </p>
                {blocked ? (
                  <Button size="sm" className="gap-1.5" onClick={playBlocked}>
                    <Play className="h-4 w-4" />
                    Play
                  </Button>
                ) : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Recording" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {audioError ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-primary" />}
                  {audioError ? 'The recording could not play. Choose your answer.' : 'Choose your answer.'}
                </p>
                <span role="timer" aria-label="Time to answer" className={cn('rounded-full px-3 py-1 text-sm font-semibold tabular-nums', left <= 2 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                  {left}s
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(left * 100) / seconds}%` }} />
              </div>
            </>
          )}
        </div>

        {item.imageUrl ? <img src={item.imageUrl} alt="" className="max-h-96 rounded-lg border" /> : null}
        {item.questions.map((question) => (
          <Question key={question.id} question={question} chosen={answers[question.id]} onChoose={choose} showAudio={false} />
        ))}
      </div>
      {leaveDialog}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, Eye, LayoutGrid, Pause, Play, RotateCcw, X } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { Button } from '../../../components/ui';
import { checkListeningLine, checkListeningPractice, getListeningPractice } from '../api/practice-api.js';
import { lineAnswers, lineBlanks, sentenceLabel } from '../lib/listening-practice.js';
import { useWavePeaks } from '../hooks/use-wave-peaks.js';
import { RevealGroup, RevealItem } from '../../../components/shared/Reveal.jsx';
import { EASE_OUT } from '../../../lib/motion.js';
import { useAudioState } from './RecordingPanel.jsx';
import { ModeSwitch } from './ListeningModeSwitch.jsx';

const SPEEDS = [0.75, 1, 1.25];
const statusStyles = {
  current: 'border-primary bg-primary text-primary-foreground',
  done: 'border-success/40 bg-success/10 text-success',
  wrong: 'border-destructive/40 bg-destructive/10 text-destructive',
  todo: 'border-transparent bg-muted/60 text-muted-foreground',
};
const barTone = { current: 'bg-primary/35', done: 'bg-success/45', wrong: 'bg-destructive/45', todo: 'bg-muted-foreground/25' };

function WaveStrip({ segments, index, statuses, peaks, time, playing, onPick }) {
  const segment = segments[index];
  const timed = (item) => item.start !== null && item.end !== null && item.end > item.start;
  const played = segment && timed(segment) ? Math.min(1, Math.max(0, (time - segment.start) / (segment.end - segment.start))) : playing ? 0.5 : 0;
  return (
    <div className="flex h-9 min-w-0 items-stretch gap-1 overflow-hidden sm:gap-1.5" role="group" aria-label="Sentences in the recording">
      {segments.map((item, at) => {
        const bars = peaks[item.id] || [];
        const state = at === index ? 'current' : statuses[item.id] || 'todo';
        return (
          <button
            key={item.id}
            type="button"
            tabIndex={-1}
            title={`Sentence ${at + 1}`}
            onClick={() => onPick(at)}
            className={cn('flex min-w-0 items-center justify-between gap-px overflow-hidden rounded-md px-0.5 transition-colors sm:px-1', at === index ? 'bg-primary/10' : 'hover:bg-muted')}
            style={{ flexGrow: bars.length || 1, flexBasis: 0 }}
          >
            {bars.map((height, bar) => (
              <span
                key={bar}
                className={cn('min-w-0 max-w-[2px] flex-1 rounded-full', at === index && bar / bars.length < played ? 'bg-primary' : barTone[state])}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            ))}
          </button>
        );
      })}
    </div>
  );
}

function WordInputs({ pieces, answers, result, shownWords, onAnswer, onFocusBlank, onEnter, onNext }) {
  const byBlank = new Map((result?.pieces || []).map((piece) => [piece.blank, piece]));
  let number = 0;
  return (
    <p className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm leading-7">
      {pieces.map((piece, index) => {
        if (!('blank' in piece)) return <span key={index} className="whitespace-pre-wrap">{piece.text}</span>;
        number += 1;
        const checked = byBlank.get(piece.blank);
        const given = shownWords[piece.blank];
        return (
          <input
            key={index}
            data-blank={piece.blank}
            aria-label={`Word ${number}`}
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            readOnly={given || checked?.correct}
            value={answers[piece.blank] || ''}
            onFocus={() => onFocusBlank(piece.blank)}
            onChange={(event) => onAnswer(piece.blank, event.target.value.replace(/\s+/g, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onEnter();
              } else if (event.key === ' ') {
                event.preventDefault();
                onNext(piece.blank);
              }
            }}
            className={cn(
              'h-7 max-w-full rounded-md border bg-background px-1 text-center text-sm outline-hidden transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20',
              given && 'border-warning/60 bg-warning/10',
              checked && !given && (checked.correct ? 'border-success/60 bg-success/10' : 'border-destructive/60 bg-destructive/10'),
            )}
            style={{ width: `${Math.max(2, piece.size || 4) + 1.6}ch` }}
          />
        );
      })}
    </p>
  );
}

function SentenceList({ exercises, exerciseIndex, onExercise, segments, index, statuses, onPick, onRedo, wrongCount }) {
  const done = segments.filter((segment) => statuses[segment.id] === 'done').length;
  const todo = Math.max(0, segments.length - done - wrongCount);
  const share = (count) => `${segments.length ? (count * 100) / segments.length : 0}%`;
  const percent = segments.length ? Math.round((done * 100) / segments.length) : 0;
  return (
    <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 lg:sticky lg:top-20 lg:self-start">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sentences</p>
            <p className="truncate text-sm font-medium">{exercises[exerciseIndex]?.title}</p>
          </div>
          <p className="shrink-0 text-right">
            <span className="text-lg font-bold tabular-nums">{done}</span>
            <span className="text-sm text-muted-foreground">/{segments.length}</span>
            <span className="block text-[11px] tabular-nums text-muted-foreground">{percent}% done</span>
          </p>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full bg-success transition-all" style={{ width: share(done) }} />
          <div className="h-full bg-destructive transition-all" style={{ width: share(wrongCount) }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Current
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success" />
            {done} done
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            {wrongCount} wrong
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            {todo} to do
          </span>
        </div>
      </div>
      {wrongCount ? (
        <Button variant="outline" size="sm" className="w-full gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRedo}>
          <RotateCcw className="h-4 w-4" />
          Redo wrong sentences ({wrongCount})
        </Button>
      ) : null}
      {exercises.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 border-t pt-3" role="group" aria-label="Exercises">
          {exercises.map((exercise, at) => {
            const finished = exercise.segmentCount && (exercise.lines?.done || 0) >= exercise.segmentCount;
            return (
            <button
              key={exercise.id}
              type="button"
              aria-pressed={at === exerciseIndex}
              title={exercise.title}
              onClick={() => onExercise(at)}
              className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', at === exerciseIndex ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', finished ? 'bg-success' : exercise.lines?.done ? 'bg-warning' : at === exerciseIndex ? 'bg-primary-foreground/60' : 'bg-muted-foreground/40')} />
              Ex {at + 1}
              <span className="tabular-nums opacity-75">
                {exercise.lines?.done || 0}/{exercise.segmentCount}
              </span>
            </button>
            );
          })}
        </div>
      ) : null}
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] justify-items-center gap-2 border-t pt-3" aria-label="Sentences">
        {segments.map((segment, at) => {
          const state = at === index ? 'current' : statuses[segment.id] || 'todo';
          return (
            <li key={segment.id}>
              <button
                type="button"
                aria-label={`Sentence ${at + 1}`}
                aria-current={at === index ? 'step' : undefined}
                onClick={() => onPick(at)}
                className={cn('relative flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors', statusStyles[state])}
              >
                {at === index ? <motion.span layoutId="current-sentence" className="absolute -inset-1 rounded-full ring-2 ring-primary/30" transition={{ type: 'spring', stiffness: 420, damping: 32 }} /> : null}
                {at + 1}
                {state === 'done' ? <Check className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-success p-0.5 text-white" /> : null}
                {state === 'wrong' ? <X className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-destructive p-0.5 text-white" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PartPractice({ kindKey, exercises, mode, onMode, onProgress }) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [statuses, setStatuses] = useState({});
  const [shownWords, setShownWords] = useState({});
  const [focused, setFocused] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [redo, setRedo] = useState(false);
  const [boxRef, animateBox] = useAnimate();
  const audioRef = useRef(null);
  const saved = useRef(false);
  const exercise = exercises[exerciseIndex];
  const segments = data?.segments || [];
  const segment = segments[index];
  const result = segment ? results[segment.id] : null;
  const player = useHeldPlayer(audioRef, {
    line: segment,
    speed,
    active: Boolean(data),
    onStop: () => focusBlank(),
  });
  const audio = useAudioState(audioRef, data?.audioUrl);
  const peaks = useWavePeaks(data?.audioUrl, segments, audio.duration);
  const wrongIds = segments.filter((item) => statuses[item.id] === 'wrong').map((item) => item.id);

  async function load(at) {
    setLoading(true);
    try {
      const next = (await getListeningPractice(exercises[at].id, mode)).data;
      setData(next);
      setStatuses(next.lines || {});
      setIndex(Math.max(0, next.segments.findIndex((item) => next.lines?.[item.id] !== 'done')));
      setAnswers({});
      setResults({});
      setShownWords({});
      setRedo(false);
      saved.current = false;
      player.reset(null);
    } catch (error) {
      notify({ title: 'Could not load the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(exerciseIndex);
  }, [exerciseIndex, mode, exercises.map((item) => item.id).join()]);

  function focusBlank(blank) {
    const focus = () => {
      const root = document.querySelector('[data-part-practice]');
      const target = (blank && root?.querySelector(`[data-blank="${blank}"]`)) || root?.querySelector('input[data-blank]:not([readonly])');
      if (target && document.activeElement !== target) target.focus();
    };
    setTimeout(focus, 0);
    setTimeout(focus, 260);
  }

  function nextBlank(blank) {
    const order = segment ? lineBlanks(segment) : [];
    const next = order[order.indexOf(blank) + 1];
    if (next) focusBlank(next);
  }

  function playLine(at = index) {
    const target = segments[at];
    if (!target) return;
    player.playLine(target).catch(() => notify({ title: 'The recording cannot be played', variant: 'destructive' }));
  }

  function go(at) {
    if (at < 0 || at >= segments.length) return;
    setIndex(at);
    setFocused(null);
    if (player.started) setTimeout(() => playLine(at), 0);
    focusBlank();
  }

  function goNext() {
    if (redo) {
      const next = segments.findIndex((item, at) => at > index && statuses[item.id] === 'wrong');
      if (next >= 0) return go(next);
      setRedo(false);
    }
    if (index < segments.length - 1) go(index + 1);
    else if (exerciseIndex < exercises.length - 1) setExerciseIndex(exerciseIndex + 1);
  }

  async function saveExercise(nextStatuses) {
    if (saved.current || !segments.every((item) => nextStatuses[item.id])) return;
    saved.current = true;
    const sent = Object.fromEntries(segments.flatMap(lineBlanks).map((blank) => [blank, answers[blank] || '']));
    try {
      await checkListeningPractice(exercise.id, sent, mode);
    } catch {
      saved.current = false;
    }
  }

  async function check() {
    if (busy || !segment) return;
    if (result?.accuracy === 100) return goNext();
    setBusy(true);
    try {
      const checked = (await checkListeningLine(exercise.id, segment.id, lineAnswers(mode, segment, answers), mode)).data;
      setResults((state) => ({ ...state, [segment.id]: checked.segment }));
      const nextStatuses = { ...statuses, [segment.id]: checked.status };
      setStatuses(nextStatuses);
      onProgress?.(exercise.id, nextStatuses);
      saveExercise(nextStatuses);
      if (boxRef.current)
        animateBox(boxRef.current, checked.status === 'done' ? { scale: [1, 1.02, 1] } : { x: [0, -7, 7, -4, 4, 0] }, { duration: checked.status === 'done' ? 0.35 : 0.4, ease: EASE_OUT });
      if (checked.status !== 'done') {
        const wrong = checked.segment.pieces.find((piece) => !piece.correct);
        if (wrong) focusBlank(wrong.blank);
      }
    } catch (error) {
      notify({ title: 'Could not check the sentence', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function showWord() {
    if (busy || !segment) return;
    const order = lineBlanks(segment);
    const right = new Set((result?.pieces || []).filter((piece) => piece.correct).map((piece) => piece.blank));
    const open = (blank) => blank && !right.has(blank) && !shownWords[blank];
    const target = open(focused) && order.includes(focused) ? focused : order.find(open);
    if (!target) return;
    setBusy(true);
    try {
      const checked = (await checkListeningLine(exercise.id, segment.id, lineAnswers(mode, segment, answers), mode)).data.segment;
      const word = checked.pieces.find((piece) => piece.blank === target)?.answer;
      if (word) {
        setAnswers((state) => ({ ...state, [target]: word }));
        setShownWords((state) => ({ ...state, [target]: true }));
      }
    } catch (error) {
      notify({ title: 'Could not show the word', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
      nextBlank(target);
    }
  }

  useEffect(() => {
    if (!data) return undefined;
    let alone = false;
    const onDown = (event) => {
      alone = event.key === 'Control';
      if (event.defaultPrevented) return;
      const typing = event.target.closest?.('input, textarea');
      if (event.key === 'Tab' && typing && !event.shiftKey) {
        event.preventDefault();
        showWord();
      } else if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        check();
      } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && (!typing || event.altKey)) {
        event.preventDefault();
        go(index + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    };
    const onUp = (event) => {
      if (event.key === 'Control' && alone) playLine();
      alone = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  });

  if (loading && !data) return <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />;
  if (!data) return null;
  if (!data.audioUrl) return <p className="text-sm text-destructive">The recording cannot be played right now.</p>;

  const right = result?.accuracy === 100;

  return (
    <div className="space-y-3 pb-14" data-part-practice>
      <audio ref={audioRef} src={data.audioUrl} preload="auto" className="hidden" />
      <RevealGroup className={cn('grid gap-3', listOpen && 'lg:grid-cols-[minmax(0,1fr)_18rem]')}>
        <RevealItem className="min-w-0 space-y-3">
          <div className="space-y-3 rounded-xl border bg-card px-3 py-2.5">
            <WaveStrip segments={segments} index={index} statuses={statuses} peaks={peaks} time={audio.time} playing={audio.playing} onPick={go} />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span aria-hidden="true" />
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous sentence" disabled={index === 0} onClick={() => go(index - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  aria-label={audio.playing ? 'Pause' : 'Play the sentence'}
                  onClick={() => (audio.playing ? audioRef.current?.pause() : playLine())}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {audio.playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next sentence" disabled={index === segments.length - 1} onClick={() => go(index + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="inline-flex justify-self-end rounded-full border bg-muted/40 p-0.5" role="group" aria-label="Speed">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={speed === value}
                    onClick={() => setSpeed(value)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:px-3',
                      speed === value ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {value}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-3 rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {exercise.title} · {sentenceLabel(kindKey, index, segment.speaker)}
              </span>
              <ModeSwitch mode={mode} onChange={onMode} />
            </div>
            <div ref={boxRef} className={cn('overflow-hidden rounded-lg border bg-muted/30 px-3 py-2 transition-colors', right && 'border-success/40 bg-success/5', result && !right && 'border-destructive/30')}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={segment.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: EASE_OUT }}>
                  <WordInputs
                    pieces={segment.pieces || []}
                    answers={answers}
                    result={result}
                    shownWords={shownWords}
                    onFocusBlank={setFocused}
                    onEnter={check}
                    onNext={nextBlank}
                    onAnswer={(blank, text) => setAnswers((state) => ({ ...state, [blank]: text }))}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={result ? `${segment.id}-${result.accuracy}` : 'hint'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={cn('text-xs', result ? (right ? 'font-medium text-success' : 'font-medium text-destructive') : 'text-muted-foreground')}
                >
                  {result ? (right ? 'Correct. Press Enter for the next sentence.' : `${result.accuracy}% right. Fix the red words.`) : 'Type each word, Space moves to the next box.'}
                </motion.p>
              </AnimatePresence>
              <Button variant="outline" size="icon" className="ml-auto h-8 w-8" aria-label="Show this word" title="Show this word (Tab)" disabled={busy || right} onClick={showWord}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" className="h-8" loading={busy} onClick={check}>
                {right ? 'Next' : 'Check'}
              </Button>
            </div>
          </div>
        </RevealItem>

        {listOpen ? (
          <RevealItem className="min-w-0">
          <SentenceList
            exercises={exercises}
            exerciseIndex={exerciseIndex}
            onExercise={setExerciseIndex}
            segments={segments}
            index={index}
            statuses={statuses}
            onPick={go}
            wrongCount={wrongIds.length}
            onRedo={() => {
              setRedo(true);
              go(segments.findIndex((item) => item.id === wrongIds[0]));
            }}
          />
          </RevealItem>
        ) : null}
      </RevealGroup>

      <div className="fixed inset-x-0 bottom-0 z-30 flex h-12 items-center gap-3 border-t bg-card px-4 sm:px-6 lg:left-64">
        <p className="hidden flex-1 text-center text-xs text-muted-foreground sm:block">
          <kbd className="rounded border bg-muted px-1">Ctrl</kbd> replay · <kbd className="rounded border bg-muted px-1">Tab</kbd> show this word · <kbd className="rounded border bg-muted px-1">Space</kbd> next box ·{' '}
          <kbd className="rounded border bg-muted px-1">Enter</kbd> check / next · <kbd className="rounded border bg-muted px-1">Alt</kbd>+<kbd className="rounded border bg-muted px-1">←</kbd>/<kbd className="rounded border bg-muted px-1">→</kbd> change sentence
        </p>
        <Button size="sm" className="ml-auto gap-1.5 tabular-nums sm:ml-0" aria-pressed={listOpen} onClick={() => setListOpen(!listOpen)}>
          <LayoutGrid className="h-4 w-4" />
          {index + 1}/{segments.length}
        </Button>
      </div>
    </div>
  );
}

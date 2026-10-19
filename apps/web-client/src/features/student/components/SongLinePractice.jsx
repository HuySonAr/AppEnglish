import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { ListeningMode } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { Button, Input } from '../../../components/ui';
import { checkListeningLine, checkListeningPractice } from '../api/practice-api.js';
import { lineAnswers, lineBlanks, runningScore, sentenceLabel } from '../lib/listening-practice.js';
import { BlankLine, CheckedWords } from './ListeningMarks.jsx';

const SPEEDS = [0.75, 1, 1.25];

// A song practised one line at a time (D93): the line plays and stops at its
// end, only that line is shown to write down (or to fill in), it is checked at
// once, and the next line plays on. After the last line the whole song is
// checked, which keeps the best score, and every line can be looked at again.
//   data      the exercise as opened (GET), its mode and timed lines
//   onScored  receives the check of the whole song
export function SongLinePractice({ exerciseId, data, onScored }) {
  const { segments, mode } = data;
  const blanksMode = mode === ListeningMode.BLANKS;
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  // Line id (full mode) or blank number (blanks mode) → what was written.
  const [answers, setAnswers] = useState({});
  // Line id → its check.
  const [results, setResults] = useState({});
  // The check of the whole song, once every line is done.
  const [final, setFinal] = useState(null);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const segment = segments[index];
  // The player stops at the end of the line; then its box is ready to type in.
  const { started, playLine: playHeld, reset } = useHeldPlayer(audioRef, {
    line: segment,
    speed,
    active: !final,
    onStop: () => (inputRef.current || document.querySelector('input[aria-label*=", blank"]'))?.focus(),
  });
  const label = sentenceLabel('song', index);
  const blanks = blanksMode ? lineBlanks(segment || {}) : [];
  // In blanks mode a line without blanks is only listened to.
  const nothingToWrite = blanksMode && !blanks.length;
  const result = segment ? results[segment.id] : null;
  const done = segment && (result || (nothingToWrite && started));
  const last = index === segments.length - 1;

  // Plays the line `at` from its start.
  function playLine(at = index) {
    playHeld(segments[at]).catch(() => {
      notify({ title: 'The song cannot be played', description: 'Try again, or check your sound settings.', variant: 'destructive' });
    });
  }

  async function checkLine() {
    if (busy || result) return;
    setBusy(true);
    try {
      const checked = (await checkListeningLine(exerciseId, segment.id, lineAnswers(mode, segment, answers), mode)).data;
      setResults((current) => ({ ...current, [segment.id]: checked.segment }));
    } catch (error) {
      notify({ title: 'Could not check the line', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const scored = (await checkListeningPractice(exerciseId, answers, mode)).data;
      setFinal(scored);
      onScored(scored);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not check the song', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (busy) return;
    if (last) {
      finish();
      return;
    }
    setIndex(index + 1);
    playLine(index + 1);
  }

  function restart() {
    reset(segments[0]);
    setIndex(0);
    setAnswers({});
    setResults({});
    setFinal(null);
  }

  // Enter checks the line, then goes on to the next one.
  const onEnter = () => (done ? next() : checkLine());
  useEffect(() => {
    if (!done || final) return undefined;
    const onKey = (event) => {
      // An Enter already used by a box (to check the line) does not also go
      // on: the check can come back while that key press is still on its way.
      if (event.key === 'Enter' && !event.isComposing && !event.defaultPrevented) {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const score = runningScore(results);

  if (!data.audioUrl) return <p className="text-sm text-destructive">The song cannot be played right now.</p>;

  if (final)
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your score</p>
          <p className={cn('mt-2 text-5xl font-bold tracking-tight', final.accuracy >= 80 ? 'text-success' : 'text-foreground')}>{final.accuracy}%</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Best {final.bestAccuracy}% · {final.checkCount} time{final.checkCount === 1 ? '' : 's'}. Capital letters, punctuation and accents
            do not count; “don't” and “do not”, “five” and “5” are the same.
          </p>
          <Button className="mt-4 gap-1.5" onClick={restart}>
            <RotateCcw className="h-4 w-4" />
            Practise again
          </Button>
        </div>
        <ol className="space-y-3">
          {final.segments.map((line, at) => (
            <li key={line.id} className="space-y-1 rounded-xl border bg-card p-4 text-sm shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{sentenceLabel('song', at)}</span>
                {line.accuracy !== null ? (
                  <span className={cn('ml-auto font-semibold tabular-nums', line.accuracy === 100 ? 'text-success' : 'text-destructive')}>{line.accuracy}%</span>
                ) : null}
              </div>
              {blanksMode ? <BlankLine pieces={line.pieces} answers={answers} label={sentenceLabel('song', at)} /> : <CheckedWords words={line.words} />}
              {!blanksMode ? <p className="text-muted-foreground">You wrote: {line.typed || '(nothing)'}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground tabular-nums">
          <span>
            Line {index + 1} of {segments.length}
          </span>
          {score !== null ? <span>Score so far {score}%</span> : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + (done ? 1 : 0)) * 100) / segments.length}%` }} />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <p className="font-medium">{label}</p>

        {/* The browser's player, held to this line: it stops at the line's end. */}
        <div className="space-y-2">
          <audio ref={audioRef} src={data.audioUrl} controls controlsList="nodownload" preload="auto" className="w-full" />
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={!started} onClick={() => playLine()}>
              <RotateCcw className="h-4 w-4" />
              From the start of the line
            </Button>
            <span className="ml-auto">Speed</span>
            {SPEEDS.map((value) => (
              <Button key={value} variant={speed === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
                {value}×
              </Button>
            ))}
          </div>
        </div>

        {!started ? (
          <p className="text-sm text-muted-foreground">Press play: the song plays this line and stops at its end.</p>
        ) : nothingToWrite ? (
          <p className="text-lg">{segment.pieces.map((piece) => piece.text).join('')}</p>
        ) : blanksMode ? (
          <div className="text-lg">
            <BlankLine
              pieces={result ? result.pieces : segment.pieces}
              answers={answers}
              label={label}
              onEnter={onEnter}
              onAnswer={(blank, text) => setAnswers((current) => ({ ...current, [blank]: text }))}
            />
          </div>
        ) : result ? (
          <div className="space-y-1">
            <div className="text-lg">
              <CheckedWords words={result.words} />
            </div>
            <p className="text-sm text-muted-foreground">You wrote: {result.typed || '(nothing)'}</p>
          </div>
        ) : (
          <Input
            ref={inputRef}
            aria-label={`${label}: what you hear`}
            className="h-11 text-base"
            autoComplete="off"
            spellCheck={false}
            maxLength={2000}
            value={answers[segment.id] || ''}
            onChange={(event) => setAnswers((current) => ({ ...current, [segment.id]: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onEnter();
              }
            }}
          />
        )}

        {result && result.accuracy !== null ? (
          <p className={cn('font-semibold', result.accuracy === 100 ? 'text-success' : 'text-destructive')}>
            {result.accuracy === 100 ? 'All right!' : `${result.accuracy}% right.`} {blanksMode ? '' : `The line is: “${result.text}”`}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {started && !done ? (
            <Button loading={busy} disabled={busy} className="gap-1.5" onClick={checkLine}>
              <Check className="h-4 w-4" />
              Check
            </Button>
          ) : null}
          {done ? (
            <Button loading={busy} disabled={busy} className="gap-1.5" onClick={next}>
              {last ? 'See my score' : 'Next line'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
          {started ? <span className="text-xs text-muted-foreground">Enter {done ? (last ? 'shows your score' : 'goes on') : 'checks the line'}</span> : null}
        </div>
      </div>
    </div>
  );
}

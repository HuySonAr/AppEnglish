import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Play, RotateCcw } from 'lucide-react';
import { ListeningMode } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { Button, Input } from '../../../components/ui';
import { checkListeningLine, checkListeningPractice } from '../api/practice-api.js';
import { lineAnswers, lineBlanks, runningScore, sentenceLabel } from '../lib/listening-practice.js';
import { BlankLine, CheckedWords } from './ListeningMarks.jsx';
import { RecordingPanel } from './RecordingPanel.jsx';
import { ScoreRing } from './ScoreRing.jsx';

export function SongLinePractice({ exerciseId, data, onScored }) {
  const { segments, mode } = data;
  const blanksMode = mode === ListeningMode.BLANKS;
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [final, setFinal] = useState(null);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const segment = segments[index];
  const { started, playLine: playHeld, reset } = useHeldPlayer(audioRef, {
    line: segment,
    speed,
    active: !final,
    onStop: () => (inputRef.current || document.querySelector('input[aria-label*=", blank"]'))?.focus(),
  });
  const label = sentenceLabel('song', index);
  const blanks = blanksMode ? lineBlanks(segment || {}) : [];
  const nothingToWrite = blanksMode && !blanks.length;
  const result = segment ? results[segment.id] : null;
  const done = segment && (result || (nothingToWrite && started));
  const last = index === segments.length - 1;

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

  const onEnter = () => (done ? next() : checkLine());
  useEffect(() => {
    if (!done || final) return undefined;
    const onKey = (event) => {
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
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row">
          <ScoreRing percent={final.accuracy} tone={final.accuracy >= 80 ? 'success' : 'primary'} label="this time" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <p className="text-lg font-semibold">
              Best {final.bestAccuracy}% · {final.checkCount} time{final.checkCount === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-muted-foreground">Capitals, punctuation and accents do not count.</p>
            <Button className="gap-1.5" onClick={restart}>
              <RotateCcw className="h-4 w-4" />
              Practise again
            </Button>
          </div>
        </div>
        <ol className="space-y-3">
          {final.segments.map((line, at) => (
            <li key={line.id} className={cn('space-y-1 rounded-2xl border-2 bg-card p-4 text-sm shadow-sm', line.accuracy === 100 ? 'border-success/40 bg-success/5' : line.accuracy !== null ? 'border-destructive/30' : 'border-transparent')}>
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

  const doneIds = new Set(Object.entries(results).filter(([, line]) => line.accuracy === 100).map(([id]) => id));

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
      <RecordingPanel
        className="lg:sticky lg:top-20"
        audioRef={audioRef}
        audioUrl={data.audioUrl}
        held
        sentences={segments}
        current={index}
        doneIds={doneIds}
        showSentence={false}
        onSelect={(at) => {
          if (at < index) playHeld(segments[at]).catch(() => {});
        }}
        onPlayLine={() => playLine()}
        speed={speed}
        onSpeed={setSpeed}
      />
      <div className="min-w-0 space-y-4">
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

      <div className="space-y-5 rounded-2xl border-2 border-primary/20 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{label}</p>
          {started ? (
            <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => playLine()}>
              <RotateCcw className="h-4 w-4" />
              Again
            </Button>
          ) : null}
        </div>

        {!started ? (
          <Button size="lg" className="gap-1.5" onClick={() => playLine()}>
            <Play className="h-4 w-4" />
            Play the line
          </Button>
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
    </div>
  );
}

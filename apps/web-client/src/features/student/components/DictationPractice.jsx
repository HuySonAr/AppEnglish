import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { Button, Input } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { checkListeningLine, checkListeningPractice } from '../api/practice-api.js';
import { fillsBlanks, isHideMode, lineAnswers, lineBlanks, maskedWords, runningScore, sentenceLabel } from '../lib/listening-practice.js';
import { CheckedWords } from './ListeningMarks.jsx';
import { SpeedSwitch, useAudioState } from './RecordingPanel.jsx';
import { ScoreRing } from './ScoreRing.jsx';
import { TranscriptTab } from './TranscriptTab.jsx';

const isRight = (result) => result && result.accuracy === 100;

function MaskedLine({ words }) {
  return (
    <p className="text-lg leading-8 tracking-wide">
      {maskedWords(words).map((word, index) => (
        <span key={index}>
          {index ? ' ' : ''}
          <span className={cn(word.status === 'correct' && 'text-success', word.status === 'hidden' && 'font-mono font-bold text-destructive', word.status === 'extra' && 'text-destructive line-through')}>{word.text}</span>
        </span>
      ))}
    </p>
  );
}

export function BlankInputs({ pieces, answers, result, revealed, shownWords = {}, onAnswer, onEnter, onFocusBlank }) {
  const byBlank = new Map((result?.pieces || []).filter((piece) => 'blank' in piece).map((piece) => [piece.blank, piece]));
  let number = 0;
  return (
    <p className="text-lg leading-12">
      {pieces.map((piece, index) => {
        if (!('blank' in piece)) return <span key={index}>{piece.text}</span>;
        number += 1;
        const checked = byBlank.get(piece.blank);
        const value = revealed && checked ? checked.answer : answers[piece.blank] || '';
        const given = shownWords[piece.blank];
        return (
          <Input
            key={index}
            aria-label={`Blank ${number}`}
            className={cn(
              'mx-1 inline-flex h-10 w-32 align-middle text-base',
              given && 'border-warning bg-warning/10',
              checked && !given && (checked.correct ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'),
            )}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            readOnly={revealed || given || checked?.correct}
            value={value}
            onFocus={() => onFocusBlank?.(piece.blank)}
            onChange={(event) => onAnswer(piece.blank, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onEnter();
              }
            }}
          />
        );
      })}
    </p>
  );
}

export function DictationPractice({ exerciseId, data, onScored }) {
  const { segments, mode, exercise } = data;
  const blanksMode = fillsBlanks(mode);
  const hideMode = isHideMode(mode);
  const [focused, setFocused] = useState(null);
  const [shownWords, setShownWords] = useState({});
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [revealed, setRevealed] = useState({});
  const [final, setFinal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('dictation');
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const segment = segments[index];
  const player = useHeldPlayer(audioRef, { line: tab === 'dictation' ? segment : null, speed, active: !final && tab === 'dictation', onStop: () => inputRef.current?.focus() });
  const audio = useAudioState(audioRef, data.audioUrl);
  const result = segment ? results[segment.id] : null;
  const shown = segment ? revealed[segment.id] : false;
  const nothingToWrite = blanksMode && segment && !lineBlanks(segment).length;
  const done = Boolean(segment && (isRight(result) || shown || (nothingToWrite && player.started)));
  const last = index === segments.length - 1;
  const finishedCount = segments.filter((item) => isRight(results[item.id]) || revealed[item.id]).length;
  const score = runningScore(results);

  function playLine(at = index) {
    player.playLine(segments[at]).catch(() => notify({ title: 'The recording cannot be played', description: 'Try again, or check your sound settings.', variant: 'destructive' }));
  }

  function go(at) {
    if (at < 0 || at >= segments.length) return;
    setIndex(at);
    if (player.started) playLine(at);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function checkLine({ reveal = false } = {}) {
    if (busy || !segment) return;
    setBusy(true);
    try {
      const checked = (await checkListeningLine(exerciseId, segment.id, lineAnswers(mode, segment, answers), mode)).data.segment;
      setResults((state) => ({ ...state, [segment.id]: checked }));
      if (reveal) setRevealed((state) => ({ ...state, [segment.id]: true }));
    } catch (error) {
      notify({ title: 'Could not check the sentence', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function showWord() {
    if (busy || !segment) return;
    const blanks = lineBlanks(segment);
    const right = new Set((result?.pieces || []).filter((piece) => piece.correct).map((piece) => piece.blank));
    const target = blanks.includes(focused) && !right.has(focused) && !shownWords[focused] ? focused : blanks.find((blank) => !right.has(blank) && !shownWords[blank]);
    if (target === undefined) return;
    setBusy(true);
    try {
      const checked = (await checkListeningLine(exerciseId, segment.id, lineAnswers(mode, segment, answers), mode)).data.segment;
      const word = checked.pieces.find((piece) => piece.blank === target)?.answer;
      if (word) {
        setAnswers((state) => ({ ...state, [target]: word }));
        setShownWords((state) => ({ ...state, [target]: true }));
      }
    } catch (error) {
      notify({ title: 'Could not show the word', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const sent = hideMode ? Object.fromEntries(segments.flatMap(lineBlanks).map((blank) => [blank, answers[blank] || ''])) : answers;
      const scored = (await checkListeningPractice(exerciseId, sent, mode)).data;
      setFinal(scored);
      onScored(scored);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not save your score', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const onEnter = () => (done ? (last ? finish() : go(index + 1)) : checkLine());

  useEffect(() => {
    if (final || tab !== 'dictation') return undefined;
    let alone = false;
    const onDown = (event) => {
      alone = event.key === 'Control';
    };
    const onUp = (event) => {
      if (event.key === 'Control' && alone) {
        event.preventDefault();
        playLine();
      }
      alone = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  });

  useEffect(() => {
    if (!done || final || tab !== 'dictation') return undefined;
    const onKey = (event) => {
      if (event.key === 'Enter' && !event.isComposing && !event.defaultPrevented && !event.target.closest?.('textarea, input')) {
        event.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function restart() {
    player.reset(segments[0]);
    setIndex(0);
    setAnswers({});
    setResults({});
    setRevealed({});
    setShownWords({});
    setFocused(null);
    setFinal(null);
    setTab('dictation');
  }

  if (!data.audioUrl) return <p className="text-sm text-destructive">The recording cannot be played right now.</p>;

  if (final)
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6 shadow-xs sm:flex-row">
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
        <ol className="divide-y rounded-2xl border bg-card shadow-xs">
          {final.segments.map((line, at) => (
            <li key={line.id} className="space-y-1 px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">{sentenceLabel(exercise.kind, at, line.speaker)}</span>
                {line.accuracy !== null ? (
                  <span className={cn('ml-auto font-semibold tabular-nums', line.accuracy === 100 ? 'text-success' : 'text-destructive')}>{line.accuracy}%</span>
                ) : null}
              </div>
              {blanksMode ? <p>{line.text}</p> : <CheckedWords words={line.words} />}
            </li>
          ))}
        </ol>
      </div>
    );

  return (
    <div className={cn('mx-auto', tab === 'transcript' ? 'max-w-6xl' : 'max-w-3xl')}>
      <div className="flex gap-1 border-b" role="tablist">
        {[
          ['dictation', 'Dictation'],
          ['transcript', 'Full transcript'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              if (key === tab) return;
              audioRef.current?.pause();
              player.reset(key === 'transcript' ? null : segment);
              setTab(key);
            }}
            className={cn(
              '-mb-px rounded-t-lg border px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
              tab === key ? 'border-border border-b-card bg-card text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <audio ref={audioRef} src={data.audioUrl} preload="auto" className="hidden" />

      {tab === 'transcript' ? (
        <TranscriptTab exerciseId={exerciseId} audioRef={audioRef} audioUrl={data.audioUrl} speed={speed} />
      ) : (
        <div className="space-y-5 rounded-b-2xl rounded-tr-2xl border border-t-0 bg-card p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label={audio.playing ? 'Pause' : 'Play the sentence'}
              onClick={() => (audio.playing ? audioRef.current?.pause() : playLine())}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {audio.playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Previous sentence" disabled={index === 0} onClick={() => go(index - 1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="min-w-18 text-center font-semibold tabular-nums">
                {index + 1} / {segments.length}
              </span>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Next sentence" disabled={last} onClick={() => go(index + 1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="ml-auto">
              <SpeedSwitch speed={speed} onChange={setSpeed} />
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(finishedCount * 100) / segments.length}%` }} />
          </div>

          {segment.speaker ? <p className="text-sm font-medium text-muted-foreground">{segment.speaker}</p> : null}

          {!player.started ? (
            <Button size="lg" className="w-full gap-2" onClick={() => playLine()}>
              <Play className="h-5 w-5" />
              Start listening
            </Button>
          ) : blanksMode ? (
            nothingToWrite ? (
              <p className="text-lg">{segment.pieces.map((piece) => piece.text).join('')}</p>
            ) : (
              <BlankInputs
                pieces={segment.pieces}
                answers={answers}
                result={result}
                revealed={shown}
                shownWords={shownWords}
                onFocusBlank={setFocused}
                onEnter={onEnter}
                onAnswer={(blank, text) => setAnswers((state) => ({ ...state, [blank]: text }))}
              />
            )
          ) : (
            <Textarea
              ref={inputRef}
              aria-label={`Sentence ${index + 1}: what you hear`}
              rows={3}
              className={cn('resize-none text-lg', isRight(result) && 'border-success bg-success/5')}
              placeholder="Type what you hear…"
              autoComplete="off"
              spellCheck={false}
              maxLength={2000}
              readOnly={done}
              value={answers[segment.id] || ''}
              onChange={(event) => setAnswers((state) => ({ ...state, [segment.id]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onEnter();
                }
              }}
            />
          )}

          {result && !blanksMode ? (
            <div className={cn('space-y-2 rounded-xl border p-4', isRight(result) ? 'border-success/40 bg-success/10' : shown ? 'bg-muted/40' : 'border-destructive/30 bg-destructive/5')}>
              {isRight(result) ? (
                <p className="flex items-center gap-2 font-semibold text-success">
                  <Check className="h-5 w-5" />
                  You are correct!
                </p>
              ) : shown ? (
                <p className="text-sm font-medium text-muted-foreground">The answer:</p>
              ) : (
                <p className="text-sm font-medium text-destructive">Not quite. Fix the words marked *** and check again.</p>
              )}
              {isRight(result) || shown ? <p className="text-lg">{result.text}</p> : <MaskedLine words={result.words} />}
            </div>
          ) : null}
          {result && blanksMode && !nothingToWrite ? (
            <p className={cn('text-sm font-semibold', isRight(result) ? 'text-success' : 'text-destructive')}>
              {isRight(result) ? 'You are correct!' : shown ? 'The answers are filled in.' : `${result.accuracy}% right. Fix the red blanks.`}
            </p>
          ) : null}

          {player.started ? (
            <div className="flex flex-wrap items-center gap-2">
              {done ? (
                <Button loading={busy} className="gap-1.5" onClick={onEnter}>
                  {last ? 'See my score' : 'Next'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button loading={busy} className="gap-1.5" onClick={() => checkLine()}>
                    <Check className="h-4 w-4" />
                    Check
                  </Button>
                  {hideMode ? (
                    <Button variant="outline" disabled={busy} className="gap-1.5" onClick={showWord}>
                      <Eye className="h-4 w-4" />
                      Show word
                    </Button>
                  ) : (
                    <Button variant="outline" disabled={busy} className="gap-1.5" onClick={() => checkLine({ reveal: true })}>
                      <Eye className="h-4 w-4" />
                      Show answer
                    </Button>
                  )}
                  <Button variant="ghost" disabled={busy || last} className="gap-1.5" onClick={() => go(index + 1)}>
                    <SkipForward className="h-4 w-4" />
                    Skip
                  </Button>
                </>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                <kbd className="rounded border bg-muted px-1">Ctrl</kbd> replay · <kbd className="rounded border bg-muted px-1">Enter</kbd> {done ? 'next' : 'check'}
                {score !== null ? ` · score ${score}%` : ''}
              </span>
            </div>
          ) : null}
          {last && !done && finishedCount > 0 ? (
            <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={finish}>
              Finish now and see my score
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

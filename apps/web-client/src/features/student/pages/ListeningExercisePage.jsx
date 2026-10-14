import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ListeningMode } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { checkListeningPractice, getListeningPractice } from '../api/practice-api.js';
import { BlankLine, CheckedWords } from '../components/ListeningMarks.jsx';
import { SongLinePractice } from '../components/SongLinePractice.jsx';
import { isTimed, kindLabel, modeLabels, sentenceLabel } from '../lib/listening-practice.js';

const SPEEDS = [0.75, 1, 1.25];

const instructions = {
  part1: 'Write down the four statements about the photograph, (A) to (D).',
  part2: 'Write down the question, then the three responses.',
  part3: 'Write down the conversation one sentence at a time. Each sentence can be replayed on its own.',
  part4: 'Write down the talk one sentence at a time. Each sentence can be replayed on its own.',
  song: 'Listen to one line at a time; it stops at the end of the line. Write the line down and check it, then go on to the next.',
};
const blanksInstruction = 'Listen to one line at a time; it stops at the end of the line. Type the missing words and check them, then go on to the next.';

// A dictation exercise (F05B-3, D86; songs D88): the recording with its speed,
// a box per sentence (each timed sentence can be replayed alone) or, for a
// song in blanks mode, the lyrics with boxes for the missing words; then the
// check against the transcript and the best score so far for the mode. The
// mode is chosen before (D92) and comes in the address: ?mode=blanks.
export function ListeningExercisePage() {
  const { exerciseId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === ListeningMode.BLANKS ? ListeningMode.BLANKS : ListeningMode.FULL;
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  // Sentence id (or blank number in blanks mode) → what the learner wrote.
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef(null);
  // The time the player stops at while one sentence is played.
  const stopAt = useRef(null);

  async function load() {
    setState('loading');
    try {
      setData((await getListeningPractice(exerciseId, mode)).data);
      setAnswers({});
      setResult(null);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [exerciseId, mode]);

  // Keeps the chosen speed, and stops at the end of a sentence being played.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    audio.playbackRate = speed;
    const onTime = () => {
      if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
        audio.pause();
        stopAt.current = null;
      }
    };
    audio.addEventListener('timeupdate', onTime);
    return () => audio.removeEventListener('timeupdate', onTime);
  }, [data, speed]);

  function playSentence(segment) {
    const audio = audioRef.current;
    if (!audio) return;
    stopAt.current = segment.end;
    audio.currentTime = segment.start;
    audio.play().catch(() => {});
  }

  function rewind() {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 3);
  }

  async function onCheck() {
    setBusy(true);
    try {
      const checked = (await checkListeningPractice(exerciseId, answers, mode)).data;
      setResult(checked);
      const best = { bestAccuracy: checked.bestAccuracy, lastAccuracy: checked.lastAccuracy, checkCount: checked.checkCount };
      setData((current) => (mode === ListeningMode.BLANKS ? { ...current, blanks: best } : { ...current, ...best }));
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not check your answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // Back to the exercises of the topic in this way of practising.
  const topicId = data?.exercise.topic?.id;
  const back = (
    <Link
      to={topicId ? `/student/practice/listening/topics/${topicId}/${mode}` : '/student/practice/listening'}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {data?.exercise.topic?.name || 'Listening'}
    </Link>
  );

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const { exercise, segments } = data;
  // The mode of the data shown: the lines with their blanks come only with it.
  const blanksMode = data.mode === ListeningMode.BLANKS;
  const best = blanksMode ? data.blanks : data;
  const filled = blanksMode
    ? Object.values(answers).filter((text) => text.trim()).length
    : segments.filter((segment) => answers[segment.id]?.trim()).length;
  const toFill = blanksMode ? data.blankCount : segments.length;
  const checkedById = new Map((result?.segments || []).map((segment) => [segment.id, segment]));

  // A song is practised line by line (D93).
  if (exercise.kind === 'song')
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        {back}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {exercise.topic ? <Badge variant="info">{exercise.topic.name}</Badge> : null}
            <Badge variant="secondary">{exercise.level}</Badge>
            <Badge variant="outline">{modeLabels[data.mode]}</Badge>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{exercise.title}</h1>
          <p className="text-muted-foreground">{blanksMode ? blanksInstruction : instructions.song}</p>
          {best?.checkCount ? (
            <p className="text-sm text-muted-foreground">
              Your best score in “{modeLabels[data.mode]}”: <span className="font-semibold text-foreground">{best.bestAccuracy}%</span>
            </p>
          ) : null}
        </div>
        <SongLinePractice
          key={`${exerciseId}-${data.mode}`}
          exerciseId={exerciseId}
          data={data}
          onScored={(scored) =>
            setData((current) => ({
              ...current,
              ...(blanksMode
                ? { blanks: { bestAccuracy: scored.bestAccuracy, lastAccuracy: scored.lastAccuracy, checkCount: scored.checkCount } }
                : { bestAccuracy: scored.bestAccuracy, lastAccuracy: scored.lastAccuracy, checkCount: scored.checkCount }),
            }))
          }
        />
      </section>
    );

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {back}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {exercise.topic ? <Badge variant="info">{exercise.topic.name}</Badge> : null}
          <Badge variant="secondary">{exercise.level}</Badge>
          <span className="text-sm text-muted-foreground">{kindLabel(exercise.kind)}</span>
          {exercise.kind === 'song' ? <Badge variant="outline">{modeLabels[data.mode]}</Badge> : null}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{exercise.title}</h1>
        <p className="text-muted-foreground">{blanksMode ? blanksInstruction : instructions[exercise.kind]}</p>
      </div>


      {result ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your score</p>
          <p className={cn('mt-2 text-5xl font-bold tracking-tight', result.accuracy >= 80 ? 'text-success' : 'text-foreground')}>{result.accuracy}%</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Best {result.bestAccuracy}% · checked {result.checkCount} time{result.checkCount === 1 ? '' : 's'}
            {exercise.kind === 'song' ? ` in “${modeLabels[data.mode]}”` : ''}. Capital letters, punctuation and accents do not count; “don't” and “do not”, “five” and
            “5” are the same.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => setResult(null)}>
              Edit and check again
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Start over
            </Button>
          </div>
        </div>
      ) : best?.checkCount ? (
        <p className="text-sm text-muted-foreground">
          Your best score{exercise.kind === 'song' ? ` in “${modeLabels[data.mode]}”` : ''}: <span className="font-semibold text-foreground">{best.bestAccuracy}%</span>
        </p>
      ) : null}

      <div className="sticky top-16 z-10 -mx-4 space-y-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {data.audioUrl ? (
          <audio ref={audioRef} controls src={data.audioUrl} className="w-full" />
        ) : (
          <p className="text-sm text-destructive">The recording cannot be played right now.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!data.audioUrl} onClick={rewind}>
            <RotateCcw className="h-4 w-4" />3 s
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">Speed</span>
          {SPEEDS.map((value) => (
            <Button key={value} variant={speed === value ? 'default' : 'outline'} size="sm" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
              {value}×
            </Button>
          ))}
        </div>
      </div>

      <ol className="space-y-3">
        {segments.map((segment, index) => {
          const checked = checkedById.get(segment.id);
          const label = sentenceLabel(exercise.kind, index, segment.speaker);
          return (
            <li key={segment.id} className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{label}</span>
                {isTimed(segment) ? (
                  <Button variant="ghost" size="sm" className="gap-1.5" disabled={!data.audioUrl} onClick={() => playSentence(segment)}>
                    <Play className="h-4 w-4" />
                    {exercise.kind === 'song' ? 'Play this line' : 'Play this sentence'}
                  </Button>
                ) : null}
                {checked && checked.accuracy !== null ? (
                  <span className={cn('ml-auto text-sm font-semibold tabular-nums', checked.accuracy === 100 ? 'text-success' : 'text-destructive')}>
                    {checked.accuracy}%
                  </span>
                ) : null}
              </div>
              {blanksMode ? (
                <BlankLine
                  pieces={checked ? checked.pieces : segment.pieces}
                  answers={answers}
                  label={label}
                  onAnswer={(blank, text) => setAnswers((current) => ({ ...current, [blank]: text }))}
                />
              ) : checked ? (
                <div className="space-y-1 text-sm">
                  <CheckedWords words={checked.words} />
                  <p className="text-muted-foreground">You wrote: {checked.typed || '(nothing)'}</p>
                </div>
              ) : (
                <Textarea
                  aria-label={`${label}: what you hear`}
                  rows={2}
                  maxLength={2000}
                  spellCheck={false}
                  autoComplete="off"
                  value={answers[segment.id] || ''}
                  onChange={(event) => setAnswers((current) => ({ ...current, [segment.id]: event.target.value }))}
                />
              )}
            </li>
          );
        })}
      </ol>

      {result ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={busy} disabled={busy} onClick={onCheck}>
            {busy ? 'Checking…' : 'Check my answers'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {filled} of {toFill} {blanksMode ? 'blanks filled' : 'written'}
          </span>
        </div>
      )}
    </section>
  );
}

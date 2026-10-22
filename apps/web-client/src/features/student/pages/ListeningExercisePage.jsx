import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Play, RotateCcw } from 'lucide-react';
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
import { RecordingPanel } from '../components/RecordingPanel.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { SongLinePractice } from '../components/SongLinePractice.jsx';
import { isTimed, kindLabel, modeLabels, sentenceLabel } from '../lib/listening-practice.js';

const instructions = {
  part1: 'Write down the four statements, (A) to (D).',
  part2: 'Write down the question and the three responses.',
  part3: 'Write down each sentence of the conversation.',
  part4: 'Write down each sentence of the talk.',
  song: 'Write down each line, then check it.',
};
const blanksInstruction = 'Type the missing words of each line.';

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
  const [current, setCurrent] = useState(0);
  const audioRef = useRef(null);
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

  function select(index, { play = false } = {}) {
    const segment = data.segments[index];
    if (!segment) return;
    setCurrent(index);
    if (play && isTimed(segment)) playSentence(segment);
    else if (audioRef.current && segment.start !== null) audioRef.current.currentTime = segment.start;
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
  const blanksMode = data.mode === ListeningMode.BLANKS;
  const best = blanksMode ? data.blanks : data;
  const filled = blanksMode
    ? Object.values(answers).filter((text) => text.trim()).length
    : segments.filter((segment) => answers[segment.id]?.trim()).length;
  const toFill = blanksMode ? data.blankCount : segments.length;
  const checkedById = new Map((result?.segments || []).map((segment) => [segment.id, segment]));

  if (exercise.kind === 'song')
    return (
      <section className="space-y-6">
        {back}
        <ExerciseHeader exercise={exercise} badges={<Badge variant="outline">{modeLabels[data.mode]}</Badge>} instruction={blanksMode ? blanksInstruction : instructions.song} best={best} />
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

  const doneIds = new Set((result?.segments || []).filter((segment) => segment.accuracy === 100).map((segment) => segment.id));

  return (
    <section className="space-y-6">
      {back}
      <ExerciseHeader exercise={exercise} badges={<span className="text-sm text-muted-foreground">{kindLabel(exercise.kind)}</span>} instruction={blanksMode ? blanksInstruction : instructions[exercise.kind]} best={result ? null : best} />

      {result ? (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-6 bg-card p-6 sm:flex-row">
            <ScoreRing percent={result.accuracy} tone={result.accuracy >= 80 ? 'success' : 'primary'} label="this time" />
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <p className="text-lg font-semibold">
                Best {result.bestAccuracy}% · checked {result.checkCount} time{result.checkCount === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-muted-foreground">Capitals, punctuation and accents do not count.</p>
              <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
                <Button variant="outline" onClick={() => setResult(null)}>
                  Edit and check again
                </Button>
                <Button
                  variant="ghost"
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
          </div>
        </div>
      ) : null}

      <div className="space-y-6 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        {data.audioUrl ? (
          <RecordingPanel
            className="lg:sticky lg:top-20"
            audioRef={audioRef}
            audioUrl={data.audioUrl}
            held={false}
            follow
            sentences={segments}
            current={current}
            doneIds={doneIds}
            showSentence={false}
            onSelect={select}
            onPlayLine={playSentence}
            speed={speed}
            onSpeed={setSpeed}
          />
        ) : (
          <p className="rounded-2xl border p-4 text-sm text-destructive">The recording cannot be played right now.</p>
        )}

        <div className="min-w-0 space-y-4">
          <ol className="space-y-3">
            {segments.map((segment, index) => {
              const checked = checkedById.get(segment.id);
              const label = sentenceLabel(exercise.kind, index, segment.speaker);
              const perfect = checked && checked.accuracy === 100;
              return (
                <li
                  key={segment.id}
                  className={cn(
                    'space-y-3 rounded-2xl border-2 bg-card p-4 shadow-sm transition-colors',
                    index === current ? 'border-primary/30' : 'border-transparent',
                    checked && (perfect ? 'border-success/40 bg-success/5' : 'border-destructive/30'),
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {isTimed(segment) ? (
                      <Button variant={index === current ? 'default' : 'outline'} size="icon" className="h-8 w-8 rounded-full" aria-label={`Play ${label}`} disabled={!data.audioUrl} onClick={() => select(index, { play: true })}>
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <span className="font-medium">{label}</span>
                    {checked && checked.accuracy !== null ? (
                      <span className={cn('ml-auto flex items-center gap-1 text-sm font-semibold tabular-nums', perfect ? 'text-success' : 'text-destructive')}>
                        {perfect ? <Check className="h-4 w-4" /> : null}
                        {checked.accuracy}%
                      </span>
                    ) : null}
                  </div>
                  {blanksMode ? (
                    <div className="text-lg">
                      <BlankLine pieces={checked ? checked.pieces : segment.pieces} answers={answers} label={label} onAnswer={(blank, text) => setAnswers((state) => ({ ...state, [blank]: text }))} />
                    </div>
                  ) : checked ? (
                    <div className="space-y-1">
                      <div className="text-lg">
                        <CheckedWords words={checked.words} />
                      </div>
                      <p className="text-sm text-muted-foreground">You wrote: {checked.typed || '(nothing)'}</p>
                    </div>
                  ) : (
                    <Textarea
                      aria-label={`${label}: what you hear`}
                      rows={2}
                      maxLength={2000}
                      spellCheck={false}
                      autoComplete="off"
                      className="text-base"
                      placeholder="Type what you hear"
                      value={answers[segment.id] || ''}
                      onFocus={() => setCurrent(index)}
                      onChange={(event) => setAnswers((state) => ({ ...state, [segment.id]: event.target.value }))}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {result ? null : (
            <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
              <Button loading={busy} disabled={busy} className="gap-1.5" onClick={onCheck}>
                <Check className="h-4 w-4" />
                {busy ? 'Checking…' : 'Check my answers'}
              </Button>
              <div className="flex min-w-[8rem] flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${toFill ? (filled * 100) / toFill : 0}%` }} />
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {filled}/{toFill}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ExerciseHeader({ exercise, badges, instruction, best }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {exercise.topic ? <Badge variant="info">{exercise.topic.name}</Badge> : null}
          <Badge variant="secondary">{exercise.level}</Badge>
          {badges}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{exercise.title}</h1>
        <p className="text-sm text-muted-foreground">{instruction}</p>
      </div>
      {best?.checkCount ? (
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-success">{best.bestAccuracy}%</p>
          <p className="text-xs text-muted-foreground">your best</p>
        </div>
      ) : null}
    </div>
  );
}

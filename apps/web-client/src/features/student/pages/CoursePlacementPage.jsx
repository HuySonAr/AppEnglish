import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CoursePlacementStatus } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../../components/ui';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getCoursePlacement, skipCoursePlacement, submitCoursePlacement } from '../api/course-api.js';
import { CourseTestSection, firstNumbers } from '../components/CourseTestSection.jsx';
import { nextKind, nextPath, unanswered } from '../lib/listening-course.js';

const SPEEDS = [0.75, 1, 1.25];

// The score of each level and where the learner starts.
function LevelScores({ startLevel, levelScores }) {
  return (
    <ol className="grid grid-cols-5 gap-2">
      {levelScores.map((entry) => (
        <li
          key={entry.level}
          className={cn('rounded-lg border px-2 py-2 text-center', entry.level === startLevel ? 'border-primary bg-primary/5' : 'bg-background')}
        >
          <p className="font-semibold">{entry.level}</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {entry.right}/{entry.total}
          </p>
        </li>
      ))}
    </ol>
  );
}

// The listening placement of the Listening course (D103): recordings from A1
// to C1 with multiple-choice questions, taken once (or skipped). Each level
// is known at 60% of its questions; the learner starts at the first level not
// known, and the levels below are open for review.
export function CoursePlacementPage() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [speed, setSpeed] = useState(1);

  async function load() {
    setState('loading');
    try {
      setData((await getCoursePlacement()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not open the placement', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    document.querySelectorAll('audio').forEach((audio) => {
      audio.playbackRate = speed;
    });
  }, [speed]);

  async function submit() {
    setBusy('submit');
    try {
      const scored = (await submitCoursePlacement({ versionId: data.versionId, answers })).data;
      document.querySelectorAll('audio').forEach((audio) => audio.pause());
      setResult(scored);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not submit your answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    setBusy('skip');
    try {
      await skipCoursePlacement();
      notify({ title: 'You start at A1' });
      navigate('/student/listening-course');
    } catch (error) {
      notify({ title: 'Could not skip the placement', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(null);
    }
  }

  const back = (
    <Link to="/student/listening-course" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening course
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

  // Already taken or skipped.
  if (data.status !== CoursePlacementStatus.NOT_STARTED && !result)
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        {back}
        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Listening placement</h1>
          <p className="text-muted-foreground">
            {data.status === CoursePlacementStatus.SKIPPED ? 'You skipped the placement and started at A1.' : `You took the placement and started at ${data.startLevel}.`} It is
            taken once; pass a level test to move up.
          </p>
          {data.levelScores.length ? <LevelScores startLevel={data.startLevel} levelScores={data.levelScores} /> : null}
          <Button asChild>
            <Link to="/student/listening-course">Back to the course</Link>
          </Button>
        </div>
      </section>
    );

  const questions = data.sections.flatMap((section) => section.questions);
  const missing = unanswered(questions, answers).length;
  const sections = result ? result.sections : data.sections;
  const firsts = firstNumbers(sections);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {back}
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Compass className="h-6 w-6 text-primary" />
          {data.title}
        </h1>
        {!result ? (
          <p className="text-muted-foreground">
            {questions.length} questions on {data.sections.length} recordings, from easy to hard, no time limit. Your answers decide the level you start the
            course at; you can take it once. Not sure? Start at A1 instead.
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">You start at</p>
          <p className="text-5xl font-bold tracking-tight text-primary">{result.startLevel}</p>
          <p className="text-sm text-muted-foreground">
            A level counts as known at {result.levelPassPercent}% of its questions. The levels below {result.startLevel} stay open for review.
          </p>
          <LevelScores startLevel={result.startLevel} levelScores={result.levelScores} />
          <div className="flex flex-wrap justify-center gap-2">
            {result.next ? (
              <Button className="gap-1.5" onClick={() => navigate(nextPath(result.next))}>
                {nextKind[result.next.type]}: {result.next.title}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
            <Button asChild variant={result.next ? 'outline' : 'default'}>
              <Link to="/student/listening-course">Go to the course</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-1 text-sm text-muted-foreground">
        <span>Speed</span>
        {SPEEDS.map((value) => (
          <Button key={value} variant={speed === value ? 'secondary' : 'ghost'} size="sm" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
            {value}×
          </Button>
        ))}
      </div>

      {sections.map((section, index) => (
        <CourseTestSection
          key={`${result ? 'review' : 'test'}-${section.id}`}
          index={index}
          section={section}
          first={firsts[index]}
          speed={speed}
          answers={result ? null : answers}
          onChoose={(questionId, optionId) => setAnswers((current) => ({ ...current, [questionId]: optionId }))}
        />
      ))}

      {!result ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-1.5" loading={busy === 'submit'} disabled={Boolean(busy) || missing > 0} onClick={submit}>
            <Check className="h-4 w-4" />
            Submit answers
          </Button>
          <Button variant="ghost" loading={busy === 'skip'} disabled={Boolean(busy)} onClick={skip}>
            Skip and start at A1
          </Button>
          {missing ? (
            <span className="text-sm text-muted-foreground">
              {missing} question{missing === 1 ? '' : 's'} left to answer.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

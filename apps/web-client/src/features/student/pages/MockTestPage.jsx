import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, ListChecks, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MockAttemptKind, TestTrend } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import {
  getMockAttempt,
  getMockReview,
  getMockTest,
  saveMockAnswers,
  startMockAttempt,
  submitMockAttempt,
} from '../api/mock-api.js';
import { AttemptList } from '../components/AttemptList.jsx';
import { TestExam } from '../components/TestExam.jsx';
import { TestProgression } from '../components/TestProgression.jsx';
import { TestReview } from '../components/TestReview.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';

const FULL = { kind: MockAttemptKind.FULL };
const mini = (partKey) => ({ kind: MockAttemptKind.MINI, partKey });
const sameSeries = (a, b) => a.kind === b.kind && (a.partKey || null) === (b.partKey || null);
const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };
const trendIcons = {
  [TestTrend.IMPROVED]: { icon: TrendingUp, tone: 'text-success', label: 'Improving' },
  [TestTrend.DECLINED]: { icon: TrendingDown, tone: 'text-destructive', label: 'Went down' },
  [TestTrend.UNCHANGED]: { icon: Minus, tone: 'text-muted-foreground', label: 'Same as before' },
};

// One mock test: take it in full (timed; the first attempt counts for XP) or
// one part at a time as a mini test (no time limit, no XP), with the history
// of both and the answers of every finished attempt.
export function MockTestPage() {
  const { mockTestId } = useParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  // The attempt being taken (from the API), or null.
  const [exam, setExam] = useState(null);
  // { reference, attempt, parts } of the attempt whose answers are shown.
  const [review, setReview] = useState(null);
  // The series whose history is open: FULL or a part's mini test.
  const [history, setHistory] = useState(FULL);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setData((await getMockTest(mockTestId)).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the mock test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    setExam(null);
    setReview(null);
    setHistory(FULL);
    load();
  }, [mockTestId]);

  // Starts the attempt, or resumes the one in progress.
  async function onStart(reference) {
    setBusy(true);
    try {
      setReview(null);
      setExam((await startMockAttempt(mockTestId, reference)).data);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not start the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(answers) {
    const reference = exam.partKey ? mini(exam.partKey) : FULL;
    setBusy(true);
    try {
      const result = (await submitMockAttempt(mockTestId, reference, answers)).data;
      setReview({ reference, ...result });
      setHistory(reference);
    } catch (error) {
      notify({ title: 'Could not submit the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      // The attempt is over either way (submitted, or its time ran out).
      setExam(null);
      await load({ quiet: true });
      setBusy(false);
      window.scrollTo({ top: 0 });
    }
  }

  async function onReview(reference, attemptNumber) {
    setBusy(true);
    try {
      setReview({ reference, ...(await getMockReview(mockTestId, reference, attemptNumber)).data });
    } catch (error) {
      notify({ title: 'Could not load the answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // After a reload the attempt in progress is fetched again when resumed.
  async function onResume(reference) {
    setBusy(true);
    try {
      const attempt = (await getMockAttempt(mockTestId, reference)).data;
      if (attempt.status === 'IN_PROGRESS') {
        setReview(null);
        setExam(attempt);
        window.scrollTo({ top: 0 });
      } else await load({ quiet: true });
    } catch (error) {
      notify({ title: 'Could not resume the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/student/mock-tests">
          Back to mock tests
        </Link>
      </div>
    );

  if (exam)
    return (
      <TestExam
        name={exam.partKey ? 'mini test' : 'mock test'}
        retakeAllowed
        attempt={exam}
        saveAnswers={(answers) => saveMockAnswers(mockTestId, exam.partKey ? mini(exam.partKey) : FULL, answers)}
        submitting={busy}
        onSubmit={onSubmit}
      />
    );

  const { mockTest, full, parts } = data;
  const openPart = history.partKey ? parts.find((part) => part.key === history.partKey) : null;
  const series = openPart ? openPart.mini : full;
  const shownNumber = review?.attempt && sameSeries(review.reference, history) ? review.attempt.attemptNumber : null;

  return (
    <section className="space-y-6">
      <Link
        to="/student/mock-tests"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mock tests
      </Link>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Level {mockTest.level}</Badge>
          <h1 className="text-2xl font-bold">{mockTest.title}</h1>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            {mockTest.questionCount} questions
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {mockTest.durationMinutes} minutes
          </span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Full test: one clock for all seven parts, move between them freely. Only your first full
          attempt counts for XP; later attempts show how you develop. Scores on the 990 scale are
          estimates, not official TOEIC scores.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {full.inProgress ? (
            <Button disabled={busy} onClick={() => onResume(FULL)}>
              Resume the full test
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => onStart(FULL)}>
              {full.attempts.length ? 'Take the full test again' : 'Start the full test'}
            </Button>
          )}
          <Button variant={history.kind === MockAttemptKind.FULL ? 'secondary' : 'outline'} onClick={() => setHistory(FULL)}>
            Full test history ({full.attempts.length})
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Mini tests</h2>
          <p className="text-sm text-muted-foreground">
            One part of this test, with no time limit and no XP. Take them as often as you like and
            follow your progress part by part.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((part) => {
            const latest = part.mini.attempts.at(-1);
            const trend = part.mini.progression ? trendIcons[part.mini.progression.trend] : null;
            const open = history.partKey === part.key;
            return (
              <li key={part.key} className={cn('flex flex-col rounded-xl border bg-card p-4 shadow-sm', open && 'border-primary/50')}>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {skillLabels[part.skill]}
                </p>
                <p className="font-semibold">
                  Part {part.number}: {part.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {part.questionCount} question{part.questionCount === 1 ? '' : 's'}
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm tabular-nums">
                  {latest ? (
                    <>
                      Latest <span className="font-bold">{latest.scorePercent}%</span>
                      {trend ? (
                        <span className={cn('flex items-center gap-1 text-xs font-medium', trend.tone)}>
                          <trend.icon className="h-4 w-4" />
                          {trend.label}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not taken yet</span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {part.mini.inProgress ? (
                    <Button size="sm" disabled={busy} onClick={() => onResume(mini(part.key))}>
                      Resume
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busy || !part.questionCount} onClick={() => onStart(mini(part.key))}>
                      {latest ? 'Again' : 'Start'}
                    </Button>
                  )}
                  <Button size="sm" variant={open ? 'secondary' : 'outline'} disabled={!part.mini.attempts.length} onClick={() => setHistory(mini(part.key))}>
                    History ({part.mini.attempts.length})
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {openPart ? `History of Part ${openPart.number} mini tests` : 'History of the full test'}
        </h2>
        {series.attempts.length ? (
          <>
            <TestProgression attempts={series.attempts} progression={series.progression} />
            <AttemptList
              attempts={series.attempts}
              shownNumber={shownNumber}
              busy={busy}
              onReview={(attemptNumber) => onReview(history, attemptNumber)}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No finished attempt yet.</p>
        )}
      </div>

      {review?.attempt && sameSeries(review.reference, history) ? (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {review.reference.partKey ? 'Mini test' : 'Full test'} · attempt {review.attempt.attemptNumber}
            </p>
            <p className="mt-2 text-5xl font-bold tracking-tight text-primary">{review.attempt.scorePercent}%</p>
            <p className="mt-1 text-muted-foreground">
              {review.attempt.correctCount} of {review.attempt.totalCount} correct
            </p>
            {review.attempt.estimated ? (
              <p className="mt-3 text-sm">
                Estimated score <span className="text-lg font-bold">{review.attempt.estimated.totalScore}</span> / 990
                {' · '}Listening {review.attempt.estimated.listeningScore} · Reading {review.attempt.estimated.readingScore}
              </p>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold">Answers and explanations</h2>
          <TestReview parts={review.parts} />
        </div>
      ) : null}
    </section>
  );
}

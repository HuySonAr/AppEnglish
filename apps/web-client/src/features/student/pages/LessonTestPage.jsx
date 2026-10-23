import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardCheck, Clock, ListChecks, Target, Trophy } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { LESSON_TEST_QUESTION_COUNT } from '@appenglish/content-contracts';
import { LessonTestStatus } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import {
  discardLessonTest,
  getLessonRanking,
  getLessonTest,
  getLessonTestReview,
  saveLessonTestAnswers,
  startLessonTest,
  submitLessonTest,
} from '../api/lessons-api.js';
import { LessonRanking } from '../components/LessonRanking.jsx';
import { TestExam } from '../components/TestExam.jsx';
import { TestProgression } from '../components/TestProgression.jsx';
import { TestReview } from '../components/TestReview.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { TestStartCard } from '../components/TestStartCard.jsx';
import { formatRemaining } from '../lib/placement.js';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useReturnTo } from '../../../hooks/use-return-to.js';

// The lesson test: start, take it (same exam screen as the placement test),
// then the score with every answer explained, the history of attempts with how
// the results develop, and the lesson ranking.
export function LessonTestPage() {
  const { lessonId } = useParams();
  const back = useReturnTo('/student/lessons');
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [test, setTest] = useState(null);
  const [ranking, setRanking] = useState(null);
  // { attempt, parts } of the attempt being reviewed.
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setState('loading');
    try {
      const [testData, rankingData] = await Promise.all([
        getLessonTest(lessonId),
        getLessonRanking(lessonId),
      ]);
      setTest(testData.data);
      setRanking(rankingData.data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the lesson test',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    setReview(null);
    load();
  }, [lessonId]);

  async function onStart() {
    setBusy(true);
    try {
      setReview(null);
      setTest((await startLessonTest(lessonId)).data);
    } catch (error) {
      notify({ title: 'Could not start the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(answers) {
    setBusy(true);
    try {
      setReview((await submitLessonTest(lessonId, answers)).data);
    } catch (error) {
      notify({ title: 'Could not submit the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      // The attempt is over either way (submitted, or its time ran out).
      await load();
      setBusy(false);
      window.scrollTo({ top: 0 });
    }
  }

  // Leaves the test without submitting: the attempt is thrown away (D82) and
  // the learner is back on the lesson. True when it went.
  async function onDiscard() {
    try {
      await discardLessonTest(lessonId);
      navigate(`/student/lessons/${lessonId}`);
      return true;
    } catch (error) {
      notify({ title: 'Could not leave the test', description: getApiErrorMessage(error), variant: 'destructive' });
      // The attempt may be over already (its time ran out).
      await load();
      return false;
    }
  }

  // Shows the answers of one finished attempt.
  async function onReview(attemptNumber) {
    setBusy(true);
    try {
      setReview((await getLessonTestReview(lessonId, attemptNumber)).data);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not load the answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <DetailPageSkeleton aside />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={back.to} state={back.state}>
          Back to lessons
        </Link>
      </div>
    );

  if (test.status === LessonTestStatus.IN_PROGRESS)
    return (
      <TestExam
        name="lesson test"
        retakeAllowed
        attempt={test}
        saveAnswers={(answers) => saveLessonTestAnswers(lessonId, answers)}
        submitting={busy}
        onSubmit={onSubmit}
        onDiscard={onDiscard}
      />
    );

  const locked = test.status === LessonTestStatus.LOCKED;
  const passed = test.attempts.some((attempt) => attempt.passed);
  return (
    <section className="space-y-6">
      <PageBreadcrumb items={[{ label: 'Lessons', to: back.to, state: back.state }, { label: 'Lesson', to: `/student/lessons/${lessonId}`, state: back.passThrough }, { label: 'Lesson test' }]} />

      {/* Laptop: the ranking stays on the right; phone: everything in one column. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {review?.attempt ? (
            <div className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Attempt {review.attempt.attemptNumber}
              </p>
              <div className="mt-4 flex justify-center">
                <ScoreRing percent={review.attempt.scorePercent} tone={review.attempt.passed ? 'success' : 'destructive'} label="correct" />
              </div>
              <p className="mt-2 text-muted-foreground">
                {review.attempt.correctCount} of {review.attempt.totalCount} correct in{' '}
                {formatRemaining(review.attempt.durationSeconds * 1000)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Listening {review.attempt.listeningCorrect}/{review.attempt.listeningTotal} · Reading{' '}
                {review.attempt.readingCorrect}/{review.attempt.readingTotal}
              </p>
              <p className="mt-4 font-medium">
                {review.attempt.passed
                  ? 'Passed: this attempt reached the pass mark.'
                  : `Not passed: you need ${test.passPercent}% to complete the lesson.`}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline">
                  <Link to={back.to} state={back.state}>Back to lessons</Link>
                </Button>
                <Button disabled={busy} onClick={onStart}>
                  Take the test again
                </Button>
              </div>
            </div>
          ) : (
            <TestStartCard
              icon={Trophy}
              eyebrow="Parts 1–4 Listening · Parts 5–7 Reading"
              title="Lesson test"
              badges={passed ? <Badge variant="success">Passed</Badge> : null}
              stats={[
                { icon: ListChecks, label: 'Questions', value: LESSON_TEST_QUESTION_COUNT },
                { icon: Clock, label: 'Minutes', value: test.durationMinutes },
                { icon: Target, label: 'To pass', value: `${test.passPercent}%` },
                { icon: ClipboardCheck, label: 'Attempts', value: test.attempts.length },
              ]}
              note={locked ? 'Finish the vocabulary, the word quiz and the fill-in first.' : 'Your first attempt counts for the ranking.'}
            >
              <Button size="lg" disabled={busy || locked} onClick={onStart}>
                {test.attempts.length ? 'Take the test again' : 'Start the test'}
              </Button>
            </TestStartCard>
          )}

          <TestProgression
            attempts={test.attempts}
            progression={test.progression}
            passPercent={test.passPercent}
          />

          {test.attempts.length ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">My attempts</h2>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm shadow-sm">
                {test.attempts.map((attempt, index) => {
                  const change = index ? attempt.correctCount - test.attempts[index - 1].correctCount : 0;
                  const shown = review?.attempt?.attemptNumber === attempt.attemptNumber;
                  return (
                    <li
                      key={attempt.attemptNumber}
                      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', shown && 'bg-primary/5')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          Attempt {attempt.attemptNumber}
                          {attempt.attemptNumber === 1 ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              counts for the ranking
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {new Date(attempt.submittedAt).toLocaleString()} ·{' '}
                          {formatRemaining(attempt.durationSeconds * 1000)} · Listening{' '}
                          {attempt.listeningCorrect}/{attempt.listeningTotal} · Reading{' '}
                          {attempt.readingCorrect}/{attempt.readingTotal}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-base font-bold">{attempt.scorePercent}%</span>
                        {change > 0 ? (
                          <span className="flex items-center text-xs font-semibold text-success">
                            <ArrowUp className="h-3.5 w-3.5" />
                            {change}
                          </span>
                        ) : null}
                        {change < 0 ? (
                          <span className="flex items-center text-xs font-semibold text-destructive">
                            <ArrowDown className="h-3.5 w-3.5" />
                            {-change}
                          </span>
                        ) : null}
                        <Badge variant={attempt.passed ? 'success' : 'outline'}>
                          {attempt.passed ? 'Passed' : 'Not passed'}
                        </Badge>
                      </div>
                      <Button
                        variant={shown ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={busy || shown}
                        onClick={() => onReview(attempt.attemptNumber)}
                      >
                        {shown ? 'Shown below' : 'View answers'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {review?.attempt ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                Answers and explanations — attempt {review.attempt.attemptNumber}
              </h2>
              <TestReview parts={review.parts} />
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LessonRanking ranking={ranking} />
        </aside>
      </div>
    </section>
  );
}

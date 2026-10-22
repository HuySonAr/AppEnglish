import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, ListChecks, Target } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { UNIT_REVIEW_PART_COUNTS, UNIT_REVIEW_PASSAGE_COUNT, UNIT_REVIEW_PASSAGE_QUESTIONS } from '@appenglish/content-contracts';
import { UnitReviewState } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { getUnitReview, submitUnitReview } from '../api/lessons-api.js';
import { MockAttemptResult } from '../components/MockAttemptResult.jsx';
import { TestExam } from '../components/TestExam.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { useFocusReturn, useListLinkState, useReturnTo } from '../../../hooks/use-return-to.js';

// The review that closes a unit (D121, D129): 19 Reading questions on the words of
// the unit, no time limit, 80% to open the next unit, retakes unlimited.
// Three screens: the overview with the attempts, the exam, the result with
// every answer explained.
export function UnitReviewPage() {
  const { unitId } = useParams();
  const back = useReturnTo('/student/lessons');
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [taking, setTaking] = useState(false);
  // { attempt, parts } of the attempt just submitted.
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setData((await getUnitReview(unitId)).data);
      setError(null);
      setState('ready');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setState('error');
    }
  }

  useEffect(() => {
    setTaking(false);
    setResult(null);
    load();
  }, [unitId]);

  async function onSubmit(answers) {
    setBusy(true);
    try {
      setResult((await submitUnitReview(unitId, answers)).data);
      setTaking(false);
      await load({ quiet: true });
      window.scrollTo({ top: 0 });
    } catch (failure) {
      notify({ title: 'Could not submit the review', description: getApiErrorMessage(failure), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-4">
        <PageHeader eyebrow="Learn" title="Unit review" description={error} />
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => load()}>
            Try again
          </Button>
          <Button asChild variant="ghost">
            <Link to={back.to} state={back.state}>Back to lessons</Link>
          </Button>
        </div>
      </section>
    );

  if (taking)
    return (
      <TestExam
        name="unit review"
        retakeAllowed
        attempt={{ expiresAt: null, serverNow: new Date().toISOString(), answers: {}, parts: data.parts }}
        saveAnswers={async () => {}}
        submitting={busy}
        onSubmit={onSubmit}
        onDiscard={async () => {
          setTaking(false);
          window.scrollTo({ top: 0 });
          return true;
        }}
      />
    );

  const passed = data.state === UnitReviewState.PASSED;

  return (
    <section className="space-y-6">
      <Link to={back.to} state={back.state} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Lessons
      </Link>

      {result ? (
        <div className="space-y-4">
          <div
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-xl border p-4',
              result.attempt.passed ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10',
            )}
          >
            {result.attempt.passed ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Target className="h-6 w-6 text-destructive" />}
            <div className="flex-1">
              <p className="font-semibold">{result.attempt.passed ? 'Review passed' : `Not passed yet: ${data.passPercent}% is needed`}</p>
              <p className="text-sm text-muted-foreground">
                {result.attempt.passed
                  ? 'The next unit is open. You can take the review again any time to practise.'
                  : 'Read the explanations below, then take the review again. There is no limit on attempts.'}
              </p>
            </div>
            <Button disabled={busy} onClick={() => setTaking(true)}>
              Take it again
            </Button>
          </div>
          <MockAttemptResult label="Unit review" attempt={result.attempt} parts={result.parts} />
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow={`Unit ${data.unit.number}`}
            title={`Unit review: ${data.unit.title}`}
            description={`${data.questionCount} Reading questions on the words of this unit: ${UNIT_REVIEW_PART_COUNTS.part5} sentences to complete and ${UNIT_REVIEW_PASSAGE_COUNT} passages with ${UNIT_REVIEW_PASSAGE_QUESTIONS} blanks each. No time limit; every answer is explained afterwards.`}
          />
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={passed ? 'success' : 'info'}>{passed ? 'Passed' : 'Open'}</Badge>
              {data.bestPercent === null ? null : <Badge variant="secondary">Best {data.bestPercent}%</Badge>}
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" />
                {data.questionCount} questions
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                {data.passPercent}% to pass and open the next unit
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4" />
                {data.attemptCount} attempt{data.attemptCount === 1 ? '' : 's'}
              </span>
            </p>
            <div className="mt-5">
              <Button disabled={busy} onClick={() => setTaking(true)}>
                {data.attemptCount ? 'Take the review again' : 'Start the review'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Your attempts ({data.attempts.length})</h2>
            {data.attempts.length ? (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm shadow-sm">
                {data.attempts.map((attempt) => (
                  <li key={attempt.attemptNumber} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Attempt {attempt.attemptNumber}</p>
                      <p className="text-xs text-muted-foreground">{new Date(attempt.submittedAt).toLocaleString()}</p>
                    </div>
                    <span className="text-base font-bold tabular-nums">{attempt.scorePercent}%</span>
                    <Badge variant={attempt.passed ? 'success' : 'outline'}>{attempt.passed ? 'Passed' : 'Not passed'}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No attempt yet.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

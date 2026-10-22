import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, ListChecks, Target, Trophy } from 'lucide-react';
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
import { TestStartCard } from '../components/TestStartCard.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useReturnTo } from '../../../hooks/use-return-to.js';

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
          <TestStartCard
            icon={Trophy}
            eyebrow={`Unit ${data.unit.number}`}
            title={`Unit review: ${data.unit.title}`}
            badges={<Badge variant={passed ? 'success' : 'info'}>{passed ? 'Passed' : 'Open'}</Badge>}
            stats={[
              { icon: ListChecks, label: 'Questions', value: data.questionCount },
              { icon: Target, label: 'To pass', value: `${data.passPercent}%` },
              { icon: ClipboardCheck, label: 'Attempts', value: data.attemptCount },
              { icon: CheckCircle2, label: 'Best', value: data.bestPercent === null ? '—' : `${data.bestPercent}%`, tone: passed ? 'text-success' : undefined },
            ]}
            note={`Part 5: ${UNIT_REVIEW_PART_COUNTS.part5} sentences. Part 6: ${UNIT_REVIEW_PASSAGE_COUNT} passages of ${UNIT_REVIEW_PASSAGE_QUESTIONS} blanks. No time limit.`}
          >
            <Button size="lg" disabled={busy} onClick={() => setTaking(true)}>
              {data.attemptCount ? 'Take the review again' : 'Start the review'}
            </Button>
          </TestStartCard>

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

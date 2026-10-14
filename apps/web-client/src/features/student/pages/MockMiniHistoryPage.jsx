import { useEffect, useState } from 'react';
import { ArrowLeft, History } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MockAttemptKind } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { DetailPageSkeleton, RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getMockReview, getMockTest } from '../api/mock-api.js';
import { AttemptList } from '../components/AttemptList.jsx';
import { MockAttemptResult } from '../components/MockAttemptResult.jsx';
import { TestProgression } from '../components/TestProgression.jsx';

const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };

// The history of the mini tests of one part of a mock test: how the attempts
// developed, the list of them, and the answers of the attempt named by
// `?attempt=` in the address (the page opens on it after a mini test is
// submitted).
export function MockMiniHistoryPage() {
  const { mockTestId, partKey } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shownNumber = Number(searchParams.get('attempt')) || null;
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  // { attempt, parts } of the attempt whose answers are shown.
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const testPath = `/student/mock-tests/${mockTestId}`;

  async function load() {
    setState('loading');
    try {
      setData((await getMockTest(mockTestId)).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the history', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [mockTestId]);

  useEffect(() => {
    setReview(null);
    setReviewing(Boolean(shownNumber));
    if (!shownNumber) return undefined;
    let current = true;
    getMockReview(mockTestId, { kind: MockAttemptKind.MINI, partKey }, shownNumber)
      .then((result) => current && setReview(result.data))
      .catch((error) => {
        if (current) notify({ title: 'Could not load the answers', description: getApiErrorMessage(error), variant: 'destructive' });
      })
      .finally(() => current && setReviewing(false));
    return () => {
      current = false;
    };
  }, [mockTestId, partKey, shownNumber]);

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={testPath}>
          Back to the mock test
        </Link>
      </div>
    );

  const part = data.parts.find((item) => item.key === partKey);
  const attempts = part?.mini.attempts || [];
  // Starting is done on the page of the mock test, which runs the test.
  const take = () => navigate(testPath, { state: { startMini: partKey } });

  return (
    <section className="space-y-6">
      <Link to={testPath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {data.mockTest.title}
      </Link>

      {part ? (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {skillLabels[part.skill]} · mini test history
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Part {part.number}: {part.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {part.questionCount} question{part.questionCount === 1 ? '' : 's'} · {attempts.length} finished attempt
            {attempts.length === 1 ? '' : 's'} · no time limit, no XP
          </p>
          <div className="mt-5">
            <Button disabled={!part.questionCount} onClick={take}>
              {part.mini.inProgress ? 'Resume the mini test' : attempts.length ? 'Take it again' : 'Start the mini test'}
            </Button>
          </div>
        </div>
      ) : null}

      {!part ? (
        <EmptyState icon={History} title="This part is not in the mock test" description="Go back to the mock test and choose one of its parts." />
      ) : !attempts.length ? (
        <EmptyState icon={History} title="No finished attempt yet" description="Your attempts at this part will be listed here with their answers." />
      ) : (
        <>
          <TestProgression attempts={attempts} progression={part.mini.progression} />
          <AttemptList
            attempts={attempts}
            shownNumber={review ? shownNumber : null}
            busy={reviewing}
            onReview={(attemptNumber) => setSearchParams({ attempt: String(attemptNumber) })}
          />
          {reviewing ? <RowsSkeleton /> : null}
          {review?.attempt ? (
            <MockAttemptResult label={`Part ${part.number} mini test`} attempt={review.attempt} parts={review.parts} />
          ) : null}
        </>
      )}
    </section>
  );
}

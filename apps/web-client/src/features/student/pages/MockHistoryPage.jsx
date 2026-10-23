import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
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
import { TestStartCard } from '../components/TestStartCard.jsx';

const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };

function seriesOf(data, partKey) {
  if (!partKey) {
    const { mockTest, full } = data;
    const latest = full.attempts.at(-1);
    const best = full.attempts.length ? Math.max(...full.attempts.map((attempt) => attempt.scorePercent)) : null;
    return {
      reference: { kind: MockAttemptKind.FULL },
      label: 'Full test',
      eyebrow: `Level ${mockTest.level} · full test history`,
      title: mockTest.title,
      attempts: full.attempts,
      progression: full.progression,
      inProgress: full.inProgress,
      startState: { startFull: true },
      canStart: true,
      stats: [
        { label: 'Attempts', value: full.attempts.length },
        { label: 'Best', value: best === null ? '—' : `${best}%` },
        { label: 'Latest estimate', value: latest?.estimated ? latest.estimated.totalScore : '—' },
        { label: 'Minutes', value: mockTest.durationMinutes },
      ],
      action: full.inProgress ? 'Resume the full test' : full.attempts.length ? 'Take the full test again' : 'Start the full test',
    };
  }
  const part = data.parts.find((item) => item.key === partKey);
  if (!part) return null;
  const attempts = part.mini.attempts;
  return {
    reference: { kind: MockAttemptKind.MINI, partKey },
    label: `Part ${part.number} mini test`,
    eyebrow: `${skillLabels[part.skill]} · mini test history`,
    title: `Part ${part.number}: ${part.title}`,
    attempts,
    progression: part.mini.progression,
    inProgress: part.mini.inProgress,
    startState: { startMini: partKey },
    canStart: part.questionCount > 0,
    stats: [
      { label: 'Questions', value: part.questionCount },
      { label: 'Attempts', value: attempts.length },
      { label: 'Latest', value: attempts.length ? `${attempts.at(-1).scorePercent}%` : '—' },
      { label: 'Time limit', value: 'None' },
    ],
    action: part.mini.inProgress ? 'Resume the mini test' : attempts.length ? 'Take it again' : 'Start the mini test',
  };
}

export function MockHistoryPage() {
  const { mockTestId, partKey } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shownNumber = Number(searchParams.get('attempt')) || null;
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
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
    const reference = partKey ? { kind: MockAttemptKind.MINI, partKey } : { kind: MockAttemptKind.FULL };
    getMockReview(mockTestId, reference, shownNumber)
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

  const series = seriesOf(data, partKey);
  const backLink = (
    <PageBreadcrumb items={[{ label: 'Mock tests', to: '/student/mock-tests' }, { label: data.mockTest.title, to: testPath }, { label: partKey ? 'Mini test history' : 'History' }]} />
  );

  if (!series)
    return (
      <section className="space-y-6">
        {backLink}
        <EmptyState icon={History} title="This part is not in the mock test" description="Go back to the mock test and choose one of its parts." />
      </section>
    );

  return (
    <section className="space-y-6">
      {backLink}
      <TestStartCard icon={History} eyebrow={series.eyebrow} title={series.title} stats={series.stats}>
        <Button size="lg" disabled={!series.canStart} onClick={() => navigate(testPath, { state: series.startState })}>
          {series.action}
        </Button>
      </TestStartCard>

      {!series.attempts.length ? (
        <EmptyState icon={History} title="No finished attempt yet" description="Your attempts will be listed here with their answers." />
      ) : (
        <>
          <TestProgression attempts={series.attempts} progression={series.progression} />
          <AttemptList
            attempts={series.attempts}
            shownNumber={review ? shownNumber : null}
            busy={reviewing}
            onReview={(attemptNumber) => setSearchParams({ attempt: String(attemptNumber) })}
          />
          {reviewing ? <RowsSkeleton /> : null}
          {review?.attempt ? <MockAttemptResult label={series.label} attempt={review.attempt} parts={review.parts} /> : null}
        </>
      )}
    </section>
  );
}

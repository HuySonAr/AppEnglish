import { useEffect, useState } from 'react';
import { Headphones } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { listeningKind } from '@appenglish/content-contracts';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { listListeningPractice } from '../api/practice-api.js';
import { PartPractice } from '../components/PartPractice.jsx';
import { toeicModeOf } from '../lib/listening-practice.js';

export function ListeningPartPage() {
  const { testId, part } = useParams();
  const [params, setParams] = useSearchParams();
  const mode = toeicModeOf(params.get('mode'));
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      setData((await listListeningPractice()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the part', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [testId, part]);

  const kind = listeningKind(part);
  const test = data?.tests?.find((item) => item.id === testId);
  const back = (
    <PageBreadcrumb
      items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Listening', to: '/student/practice/listening' }, { label: test?.name || 'Test' }, { label: kind?.number ? `Part ${kind.number}` : 'Part' }]}
    />
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

  const exercises = data.exercises.filter((exercise) => exercise.test?.id === testId && exercise.kind === part);
  if (!test || !kind?.number || !exercises.length)
    return (
      <section className="space-y-6">
        {back}
        <EmptyState icon={Headphones} title="Nothing to practise here" description="This part has no published exercises yet." />
      </section>
    );

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        {back}
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          {test.name} · Part {kind.number} <span className="font-normal text-muted-foreground">{kind.title}</span>
        </h1>
      </div>
      <PartPractice
        kindKey={part}
        exercises={exercises}
        mode={mode}
        onMode={(value) => setParams({ mode: value }, { replace: true })}
        onProgress={(exerciseId, statuses) =>
          setData((current) => ({
            ...current,
            exercises: current.exercises.map((item) =>
              item.id === exerciseId
                ? { ...item, lines: { done: Object.values(statuses).filter((status) => status === 'done').length, wrong: Object.values(statuses).filter((status) => status === 'wrong').length } }
                : item,
            ),
          }))
        }
      />
    </section>
  );
}

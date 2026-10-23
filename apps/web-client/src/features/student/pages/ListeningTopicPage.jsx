import { useEffect, useState } from 'react';
import { Headphones, PenLine, TextCursorInput } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { ListeningMode } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { listListeningPractice } from '../api/practice-api.js';
import { PracticeCard } from '../components/PracticeCard.jsx';
import { exercisesFor, modeLabels, resultOf, topicModes } from '../lib/listening-practice.js';

const modeCards = {
  [ListeningMode.BLANKS]: { icon: TextCursorInput, tone: 'success', description: 'Type the missing words.' },
  [ListeningMode.FULL]: { icon: PenLine, tone: 'primary', description: 'Write every line.' },
};

export function ListeningTopicPage() {
  const { topicId } = useParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      setData((await listListeningPractice()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the topic', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [topicId]);

  const back = (
    <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Listening', to: '/student/practice/listening' }, { label: data?.topics?.find((item) => item.id === topicId)?.name || 'Topic' }]} />
  );

  if (state === 'loading') return <CardGridPageSkeleton cards={2} toolbar={false} />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const topic = data.topics.find((item) => item.id === topicId);
  if (!topic)
    return (
      <section className="space-y-6">
        {back}
        <EmptyState icon={Headphones} title="Topic not found" description="It may have no published exercises any more." />
      </section>
    );
  const modes = topicModes(topic);
  if (modes.length === 1) return <Navigate to={`/student/practice/listening/topics/${topicId}/${modes[0]}`} replace />;

  return (
    <section className="space-y-6">
      {back}
      <PageHeader eyebrow="Listening" title={topic.name} description="Choose how you want to practise." />
      <div className="grid gap-4 sm:grid-cols-2">
        {modes.map((mode) => {
          const own = exercisesFor(data.exercises, topicId, mode);
          const tried = own.filter((exercise) => resultOf(exercise, mode).checkCount > 0).length;
          const card = modeCards[mode];
          return (
            <PracticeCard
              key={mode}
              icon={card.icon}
              title={modeLabels[mode]}
              description={card.description}
              total={own.length}
              done={tried}
              unit="song"
              to={`/student/practice/listening/topics/${topicId}/${mode}`}
              tone={card.tone}
            />
          );
        })}
      </div>
    </section>
  );
}

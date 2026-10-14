import { useEffect, useState } from 'react';
import { ArrowLeft, Headphones, PenLine, TextCursorInput } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ListeningMode } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { listListeningPractice } from '../api/practice-api.js';
import { exercisesFor, modeLabels, resultOf, topicModes } from '../lib/listening-practice.js';

const modeCards = {
  [ListeningMode.BLANKS]: { icon: TextCursorInput, tone: 'success', description: 'The lyrics are shown with words missing; type the words you hear.' },
  [ListeningMode.FULL]: { icon: PenLine, tone: 'primary', description: 'Write down every line you hear, one line at a time.' },
};

// Listening practice (D92), second step for a topic with several ways of
// practising (songs): a card per way. A topic with one way goes straight on
// to its exercises.
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
    <Link to="/student/practice/listening" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening
    </Link>
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
            <FeatureCard
              key={mode}
              icon={card.icon}
              title={modeLabels[mode]}
              description={`${card.description} ${own.length} song${own.length === 1 ? '' : 's'}${tried ? `, ${tried} tried` : ''}.`}
              to={`/student/practice/listening/topics/${topicId}/${mode}`}
              tone={card.tone}
            />
          );
        })}
      </div>
    </section>
  );
}

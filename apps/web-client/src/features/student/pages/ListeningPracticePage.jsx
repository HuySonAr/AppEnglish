import { useEffect, useState } from 'react';
import { ArrowLeft, Headphones, Music } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ListeningFormat } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { listListeningPractice } from '../api/practice-api.js';
import { isTried } from '../lib/listening-practice.js';

// Listening practice (F05B-3, D92), first step: a card per topic (Songs,
// TOEIC, …) with its number of exercises; a topic leads to its ways of
// practising, then to its exercises.
export function ListeningPracticePage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      setData((await listListeningPractice()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the listening practice', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const back = (
    <Link to="/student/practice" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Practice
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

  return (
    <section className="space-y-6">
      {back}
      <PageHeader eyebrow="Practice" title="Listening" description="Choose a topic. Listen, then write down what you hear; your best score is kept." />
      {data.topics.length === 0 ? (
        <EmptyState icon={Headphones} title="No listening exercises yet" description="Exercises will appear here when they are published." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.topics.map((topic) => {
            const own = data.exercises.filter((exercise) => exercise.topic?.id === topic.id);
            const tried = own.filter(isTried).length;
            const song = topic.format === ListeningFormat.SONG;
            return (
              <FeatureCard
                key={topic.id}
                icon={song ? Music : Headphones}
                title={topic.name}
                description={`${own.length} ${song ? 'song' : 'exercise'}${own.length === 1 ? '' : 's'}${tried ? ` · ${tried} tried` : ''}`}
                to={`/student/practice/listening/topics/${topic.id}`}
                tone={song ? 'warning' : 'info'}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, AudioLines, BarChart3, CheckCircle2, FileText, Headphones, Image, Megaphone, MessagesSquare, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LISTENING_TOEIC_KINDS } from '@appenglish/content-contracts';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../../components/ui';
import { CountUp } from '../../../components/shared/CountUp.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PracticeBanner } from '../../../components/shared/PracticeBanner.jsx';
import listeningArt from '../../../svg/Listening Education.svg';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { ProgressBar } from '../../../components/shared/ProgressBar.jsx';
import { RevealGroup, RevealItem } from '../../../components/shared/Reveal.jsx';
import { listListeningPractice } from '../api/practice-api.js';

const partIcons = { part1: Image, part2: MessagesSquare, part3: Users, part4: Megaphone };
const lift = { whileHover: { y: -3 }, transition: { type: 'spring', stiffness: 380, damping: 26 } };

function tally(exercises) {
  const total = exercises.reduce((sum, exercise) => sum + (exercise.segmentCount || 0), 0);
  const done = exercises.reduce((sum, exercise) => sum + Math.min(exercise.segmentCount || 0, exercise.lines?.done || 0), 0);
  const started = exercises.some((exercise) => exercise.lines?.done || exercise.lines?.wrong);
  return { total, done, started };
}

function PartTile({ testId, kind, exercises }) {
  const Icon = partIcons[kind.key] || Headphones;
  const { total, done, started } = tally(exercises);
  const complete = total > 0 && done >= total;
  if (!exercises.length)
    return (
      <div className="flex h-full flex-col gap-3 rounded-xl border border-dashed bg-muted/20 p-4 text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Part {kind.number}</p>
            <p className="truncate text-xs">{kind.title}</p>
          </div>
        </div>
        <p className="mt-auto text-xs">No exercises yet</p>
      </div>
    );
  return (
    <motion.div {...lift} className="h-full">
      <Link
        to={`/student/practice/listening/tests/${testId}/parts/${kind.key}`}
        className={cn(
          'group flex h-full flex-col gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          complete && 'border-success/30',
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', complete ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Part {kind.number}</p>
            <p className="truncate text-xs text-muted-foreground">{kind.title}</p>
          </div>
          {complete ? <CheckCircle2 className="h-5 w-5 text-success" /> : null}
        </div>
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums tracking-tight">
            <CountUp value={total} />
          </span>
          <span className="text-sm text-muted-foreground">sentences</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          </span>
        </p>
        <div className="mt-auto space-y-2">
          <ProgressBar value={done} total={total} className="h-1.5" barClassName={complete ? 'bg-success' : 'bg-primary'} />
          <div className="flex items-center justify-between text-xs">
            <span className={cn('tabular-nums', complete ? 'font-medium text-success' : 'text-muted-foreground')}>{complete ? 'Completed' : started ? `${done}/${total} done` : 'Not started'}</span>
            <span className="flex items-center gap-1 font-medium text-primary">
              {started && !complete ? 'Continue' : complete ? 'Practise again' : 'Start'}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function TestCard({ test, exercises }) {
  const { total, done } = tally(exercises);
  const percent = total ? Math.round((done * 100) / total) : 0;
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{test.name}</h2>
            <p className="text-xs text-muted-foreground">
              {exercises.length} exercise{exercises.length === 1 ? '' : 's'} · {total} sentences
            </p>
          </div>
        </div>
        <div className="ml-auto flex min-w-40 flex-1 items-center gap-3 sm:max-w-xs">
          <ProgressBar value={done} total={total} className="h-1.5" />
          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{percent}%</span>
        </div>
      </div>
      <RevealGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LISTENING_TOEIC_KINDS.map((kind) => (
          <RevealItem key={kind.key} className="h-full">
            <PartTile testId={test.id} kind={kind} exercises={exercises.filter((exercise) => exercise.kind === kind.key)} />
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}

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

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Listening' }]} />;

  if (state === 'loading') return <CardGridPageSkeleton cards={4} toolbar={false} />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const tests = data.tests || [];

  return (
    <section className="space-y-6">
      {back}
      <PracticeBanner
        eyebrow="Practice"
        eyebrowIcon={Headphones}
        title="TOEIC"
        accent="Listening"
        description="Pick a part of a test and fill in the words you hear."
        image={listeningArt}
        features={[
          { icon: AudioLines, title: 'Real audio', note: 'Like the real test', tone: 'destructive' },
          { icon: FileText, title: 'Varied topics', note: 'Daily practice' },
          { icon: BarChart3, title: 'Improve skills', note: 'Step by step', tone: 'success' },
        ]}
      />
      {tests.length === 0 ? (
        <EmptyState icon={Headphones} title="No listening tests yet" description="Tests will appear here when they are published." />
      ) : (
        <RevealGroup className="space-y-5">
          {data.topics.map((topic) =>
            tests
              .filter((test) => test.topicId === topic.id)
              .map((test) => (
                <RevealItem key={test.id}>
                  <TestCard test={test} exercises={data.exercises.filter((exercise) => exercise.test?.id === test.id)} />
                </RevealItem>
              )),
          )}
        </RevealGroup>
      )}
    </section>
  );
}

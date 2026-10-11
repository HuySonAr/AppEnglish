import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LessonState } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Skeleton } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { cn } from '../../../lib/utils.js';
import { getCurriculum } from '../api/lessons-api.js';

function LessonRow({ lesson }) {
  const locked = lesson.state === LessonState.LOCKED;
  const completed = lesson.state === LessonState.COMPLETED;
  const body = (
    <>
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          completed
            ? 'bg-success/15 text-success'
            : locked
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary',
        )}
      >
        {completed ? <CheckCircle2 className="h-5 w-5" /> : locked ? <Lock className="h-4 w-4" /> : lesson.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{lesson.title}</span>
        <span className="block text-sm text-muted-foreground">
          {completed ? 'Completed' : locked ? 'Locked' : 'Open'}
          {lesson.bestPercent === null ? '' : ` · best test score ${lesson.bestPercent}%`}
        </span>
      </span>
      {locked ? null : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const frame = 'flex items-center gap-4 px-4 py-3';
  return (
    <li>
      {locked ? (
        <div className={cn(frame, 'opacity-60')} aria-disabled="true">
          {body}
        </div>
      ) : (
        <Link
          to={`/student/lessons/${lesson.id}`}
          className={cn(frame, 'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

// Units and lessons with what is open, locked and completed for the learner.
export function LessonsPage() {
  const [state, setState] = useState('loading');
  const [curriculum, setCurriculum] = useState(null);

  async function load() {
    setState('loading');
    try {
      setCurriculum((await getCurriculum()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the lessons',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <Skeleton className="h-96 w-full" />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Learn"
        title="Lessons"
        description="Finish a lesson by passing its test to open the next one."
      />
      {curriculum.placementRequired ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Start with the placement test</p>
            <p className="text-sm text-muted-foreground">
              Take it, or skip it, to open your first lesson.
            </p>
          </div>
          <Button asChild>
            <Link to="/student/placement">Go to the placement test</Link>
          </Button>
        </div>
      ) : null}
      {curriculum.units.length === 0 ? (
        <EmptyState icon={BookOpen} title="No lessons yet" description="Lessons will appear here when they are published." />
      ) : (
        curriculum.units.map((unit) => (
          <div key={unit.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">
                  Unit {unit.number}: {unit.title}
                </h2>
                {unit.description ? (
                  <p className="text-sm text-muted-foreground">{unit.description}</p>
                ) : null}
              </div>
              {curriculum.startUnit === unit.number ? <Badge variant="info">Your starting unit</Badge> : null}
            </div>
            {unit.lessons.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No lessons in this unit yet.</p>
            ) : (
              <ul className="divide-y">
                {unit.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} />
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </section>
  );
}

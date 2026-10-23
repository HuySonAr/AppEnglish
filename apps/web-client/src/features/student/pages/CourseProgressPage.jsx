import { useEffect, useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { CourseLevelState } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getCourseProgress } from '../api/course-api.js';

function Stat({ label, value, detail }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function Bar({ done, total }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (done * 100) / total : 0}%` }} />
      </div>
      <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

export function CourseProgressPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      setData((await getCourseProgress()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your progress', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const back = (
    <PageBreadcrumb items={[{ label: 'Listening course', to: '/student/listening-course' }, { label: 'My progress' }]} />
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

  const passedTests = data.levels.filter((level) => level.levelTest?.passed).length;
  return (
    <section className="space-y-6">
      {back}
      <PageHeader eyebrow="Listening course" title="My progress" description="Topics count when you mark them done. Pass a level test to open the next level." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Your level" value={data.currentLevel || '—'} detail={`${data.openLevels} of ${data.levels.length} levels open`} />
        <Stat label="Topics done" value={`${data.topics.done}/${data.topics.total}`} detail="across every level" />
        <Stat label="Level tests passed" value={passedTests} detail="each one opens the next level" />
      </div>
      <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {data.levels.map((level) => {
          const open = level.state === CourseLevelState.OPEN;
          return (
            <li key={level.level} className={cn('grid gap-2 px-4 py-3 sm:grid-cols-[5rem_1fr_12rem] sm:items-center sm:gap-4', !open && 'opacity-60')}>
              <span className="flex items-center gap-2 font-semibold">
                {level.level}
                {open ? null : <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked" />}
                {level.level === data.currentLevel ? <Badge variant="info">Your level</Badge> : null}
              </span>
              <Bar {...level.topics} />
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {level.levelTest ? (
                  level.levelTest.passed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                      Test passed · best {level.levelTest.bestScore}%
                    </>
                  ) : level.levelTest.attemptCount ? (
                    `Test best ${level.levelTest.bestScore}%`
                  ) : (
                    'Test not taken'
                  )
                ) : (
                  'No level test'
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

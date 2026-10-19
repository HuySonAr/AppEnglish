import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, NotebookPen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CourseLevelState, CoursePlacementStatus } from '@appenglish/learning-contracts';
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

function Bar({ passed, total }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (passed * 100) / total : 0}%` }} />
      </div>
      <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
        {passed}/{total}
      </span>
    </div>
  );
}

const stateLabel = { [CourseLevelState.DONE]: 'Passed', [CourseLevelState.CURRENT]: 'Your level', [CourseLevelState.LOCKED]: 'Locked' };

// The learner's progress in the Listening course (D104): their level, the
// lessons passed and their average best score, the sentences to review and
// the words missed most; by level, the lessons and unit checks passed and the
// level test's best score. It covers the Listening course only.
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
    <Link to="/student/listening-course" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening course
    </Link>
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

  const placement = data.placement
    ? data.placement.status === CoursePlacementStatus.SKIPPED
      ? 'Placement skipped: started at A1'
      : `Placement: started at ${data.placement.startLevel}`
    : 'Placement not taken';

  return (
    <section className="space-y-6">
      {back}
      <PageHeader eyebrow="Listening course" title="My progress" description="How far you are in the listening course, level by level." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Your level" value={data.currentLevel || 'All passed'} detail={placement} />
        <Stat label="Lessons passed" value={`${data.lessons.passed}/${data.lessons.total}`} detail={`${data.attemptCount} lesson attempt${data.attemptCount === 1 ? '' : 's'}`} />
        <Stat label="Average best score" value={data.averageBestScore === null ? '—' : `${data.averageBestScore}%`} detail="of the lessons you tried" />
        <Stat label="Sentences to review" value={data.mistakeCount} detail="in your mistakes notebook" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="hidden grid-cols-[5rem_1fr_1fr_9rem] gap-4 border-b bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground sm:grid">
          <span>Level</span>
          <span>Lessons passed</span>
          <span>Unit checks passed</span>
          <span>Level test</span>
        </div>
        <ul className="divide-y">
          {data.levels.map((level) => (
            <li key={level.level} className={cn('grid gap-2 px-4 py-3 sm:grid-cols-[5rem_1fr_1fr_9rem] sm:items-center sm:gap-4', level.state === CourseLevelState.LOCKED && 'opacity-60')}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{level.level}</span>
                {level.state === CourseLevelState.DONE ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Passed" /> : null}
                {level.state === CourseLevelState.LOCKED ? <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked" /> : null}
                {level.state === CourseLevelState.CURRENT ? <Badge variant="info">{stateLabel[level.state]}</Badge> : null}
              </div>
              <div>
                <span className="text-xs text-muted-foreground sm:hidden">Lessons passed</span>
                <Bar {...level.lessons} />
              </div>
              <div>
                <span className="text-xs text-muted-foreground sm:hidden">Unit checks passed</span>
                <Bar {...level.unitChecks} />
              </div>
              <span className="text-sm">
                <span className="text-xs text-muted-foreground sm:hidden">Level test: </span>
                {level.levelTest ? (level.levelTest.passed ? `Passed · best ${level.levelTest.bestScore}%` : level.levelTest.bestScore === null ? 'Not taken' : `Best ${level.levelTest.bestScore}%`) : 'Not published'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Words you miss most</p>
          <Button asChild variant="outline" size="sm" className="ml-auto gap-1.5">
            <Link to="/student/listening-course/mistakes">
              <NotebookPen className="h-4 w-4" />
              My mistakes
            </Link>
          </Button>
        </div>
        {data.mostMissedWords.length ? (
          <div className="flex flex-wrap gap-2">
            {data.mostMissedWords.map((entry) => (
              <Badge key={entry.word} variant="secondary">
                {entry.word} · {entry.count}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No missed words yet.</p>
        )}
      </div>
    </section>
  );
}

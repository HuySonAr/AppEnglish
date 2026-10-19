import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Dumbbell, GraduationCap, Headphones, PlayCircle, Timer, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LessonState, PlacementStatus } from '@appenglish/learning-contracts';
import { Badge, Button } from '../../../components/ui';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { getListeningCourse } from '../api/course-api.js';
import { getCurriculum } from '../api/lessons-api.js';
import { listMockTests } from '../api/mock-api.js';
import { getPlacement } from '../api/placement-api.js';
import { getProgress } from '../api/progress-api.js';
import { bestMockPercent, greeting, lessonStats, nextLessonStep, suggestedMockTest } from '../lib/home.js';
import { nextKind, nextPath } from '../lib/listening-course.js';

// What the home page shows. Each part loads on its own, so one service being
// away hides only its part.
const sources = {
  curriculum: getCurriculum,
  placement: getPlacement,
  course: getListeningCourse,
  mocks: listMockTests,
  progress: getProgress,
};

function Bar({ value, total, className }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className={cn('h-full rounded-full bg-primary', className)} style={{ width: `${total ? Math.min(100, (value * 100) / total) : 0}%` }} />
    </div>
  );
}

// The hero: what the learner does next in the main course.
function NextStep({ step, placement }) {
  if (!step) return null;
  if (step.kind === 'placement') {
    const inProgress = placement?.status === PlacementStatus.IN_PROGRESS;
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Start here</p>
        <p className="mt-1 text-xl font-bold sm:text-2xl">{inProgress ? 'Finish your placement test' : 'Take the placement test'}</p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {inProgress
            ? 'Your 25 minutes are running. Pick up where you left off.'
            : 'About 25 minutes. It decides the unit you start at; you can also skip it and start at unit 1.'}
        </p>
        <Button asChild size="lg" className="mt-4 gap-2">
          <Link to="/student/placement">
            <ClipboardCheck className="h-4 w-4" />
            {inProgress ? 'Continue the test' : 'Go to the placement test'}
          </Link>
        </Button>
      </>
    );
  }
  if (step.kind === 'lesson')
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Up next · Unit {step.unit.number}: {step.unit.title}
        </p>
        <p className="mt-1 text-xl font-bold sm:text-2xl">
          Lesson {step.lesson.number}: {step.lesson.title}
        </p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {step.lesson.bestPercent === null
            ? 'Vocabulary, a quiz, a fill-in exercise, then the lesson test. Pass it with 80% to open the next lesson.'
            : `Your best test so far: ${step.lesson.bestPercent}%. Pass with 80% to open the next lesson.`}
        </p>
        <Button asChild size="lg" className="mt-4 gap-2">
          <Link to={`/student/lessons/${step.lesson.id}`}>
            <PlayCircle className="h-4 w-4" />
            {step.lesson.bestPercent === null ? 'Start the lesson' : 'Continue the lesson'}
          </Link>
        </Button>
      </>
    );
  if (step.kind === 'done')
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-widest text-success">All lessons completed</p>
        <p className="mt-1 text-xl font-bold sm:text-2xl">You finished every published lesson</p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Keep your level up with mock tests and the listening course. New lessons will appear here when they are published.</p>
        <Button asChild size="lg" variant="outline" className="mt-4 gap-2">
          <Link to="/student/mock-tests">
            <Timer className="h-4 w-4" />
            Take a mock test
          </Link>
        </Button>
      </>
    );
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Welcome</p>
      <p className="mt-1 text-xl font-bold sm:text-2xl">No lessons are published yet</p>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">Your lessons will appear here as soon as they are published. Meanwhile, try the listening course.</p>
    </>
  );
}

function Section({ icon: Icon, title, to, linkLabel, children, failed }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </h2>
        <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {failed ? <p className="text-sm text-muted-foreground">Could not load this part. Try again later.</p> : children}
    </div>
  );
}

function Skill({ label, skill }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{skill.percent === null ? 'No data yet' : `${skill.percent}%`}</span>
      </div>
      <Bar value={skill.percent ?? 0} total={100} />
    </div>
  );
}

// The student's home: what to do next in the main course, then where they
// stand in lessons, the listening course, mock tests and the two skills.
// Everything comes from the pages' own APIs; the server computes nothing for
// this page.
export function StudentDashboardPage() {
  const { account } = useAuth();
  const [state, setState] = useState('loading');
  const [data, setData] = useState({});
  const [failed, setFailed] = useState({});

  async function load() {
    setState('loading');
    const entries = Object.entries(sources);
    const settled = await Promise.allSettled(entries.map(([, call]) => call()));
    const loaded = {};
    const errors = {};
    settled.forEach((result, index) => {
      const [key] = entries[index];
      if (result.status === 'fulfilled') loaded[key] = result.value.data;
      else errors[key] = result.reason;
    });
    setData(loaded);
    setFailed(errors);
    if (Object.keys(loaded).length === 0) {
      setState('error');
      notify({ title: 'Could not load your home page', description: getApiErrorMessage(settled[0].reason), variant: 'destructive' });
      return;
    }
    setState('ready');
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <DetailPageSkeleton aside />;
  if (state === 'error')
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">{greeting()}</h1>
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const { curriculum, placement, course, mocks, progress } = data;
  const step = nextLessonStep(curriculum);
  const lessons = lessonStats(curriculum);
  const suggested = suggestedMockTest(mocks);
  const bestMock = bestMockPercent(mocks);
  const name = account?.email?.split('@')[0] || 'learner';
  const listeningLevel = failed.course ? '—' : course.currentLevel || (course.levels?.length ? 'C1 passed' : '—');

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <p className="relative text-sm text-muted-foreground">
            {greeting()}, {name}.
          </p>
          <div className="relative mt-3">
            {failed.curriculum ? (
              <>
                <p className="text-xl font-bold">Your lessons could not be loaded</p>
                <Button variant="outline" className="mt-4" onClick={load}>
                  Try again
                </Button>
              </>
            ) : (
              <NextStep step={step} placement={placement} />
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Lessons completed</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {lessons.completed}
              <span className="text-base font-medium text-muted-foreground"> / {lessons.total}</span>
            </p>
            <div className="mt-2">
              <Bar value={lessons.completed} total={lessons.total} />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Listening level</p>
            <p className="mt-1 text-2xl font-bold">{listeningLevel}</p>
            <p className="truncate text-xs text-muted-foreground">
              {failed.course ? 'Could not load' : course.next ? `${nextKind[course.next.type]}: ${course.next.title}` : 'Listening course'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={BookOpen} title="Lessons" to="/student/lessons" linkLabel="All lessons" failed={failed.curriculum}>
          {curriculum?.units?.length ? (
            <ul className="space-y-2">
              {curriculum.units.map((unit) => {
                const done = unit.lessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
                const current = lessons.currentUnit?.id === unit.id;
                const finished = unit.lessons.length > 0 && done === unit.lessons.length;
                return (
                  <li key={unit.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={cn('flex min-w-0 items-center gap-2', current && 'font-semibold')}>
                        <span className="truncate">
                          Unit {unit.number}: {unit.title}
                        </span>
                        {current ? <Badge variant="info">Now</Badge> : null}
                        {finished ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Completed" /> : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {done}/{unit.lessons.length}
                      </span>
                    </div>
                    <Bar value={done} total={unit.lessons.length} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No lessons are published yet.</p>
          )}
        </Section>

        <Section icon={GraduationCap} title="Listening course" to="/student/listening-course" linkLabel="Open the course" failed={failed.course}>
          {course?.next ? (
            <>
              <p className="text-sm text-muted-foreground">
                {nextKind[course.next.type]} at {course.next.level}
              </p>
              <p className="truncate font-semibold">{course.next.title}</p>
              {course.next.unitTitle ? <p className="truncate text-sm text-muted-foreground">{course.next.unitTitle}</p> : null}
              <Button asChild variant="outline" size="sm" className="mt-auto w-fit gap-1.5">
                <Link to={nextPath(course.next)}>
                  <Headphones className="h-4 w-4" />
                  Continue listening
                </Link>
              </Button>
            </>
          ) : course?.currentLevel ? (
            <p className="text-sm text-muted-foreground">Nothing more to take at {course.currentLevel} yet. New lessons will appear when they are published.</p>
          ) : course?.levels?.length ? (
            <p className="text-sm text-muted-foreground">You have passed every level test. Well done!</p>
          ) : (
            <p className="text-sm text-muted-foreground">Listening lessons will appear here when they are published.</p>
          )}
        </Section>

        <Section icon={Timer} title="Mock tests" to="/student/mock-tests" linkLabel="All mock tests" failed={failed.mocks}>
          {suggested ? (
            <>
              <p className="text-sm text-muted-foreground">
                Suggested for you · Level {suggested.level}
                {bestMock !== null ? ` · your best full test: ${bestMock}%` : ''}
              </p>
              <p className="truncate font-semibold">{suggested.title}</p>
              <p className="text-sm text-muted-foreground">
                {suggested.attemptCount ? `Taken ${suggested.attemptCount} time${suggested.attemptCount === 1 ? '' : 's'}, best ${suggested.bestPercent}%` : 'Not taken yet'}
                {suggested.durationMinutes ? ` · ${suggested.durationMinutes} min` : ''}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-auto w-fit gap-1.5">
                <Link to={`/student/mock-tests/${suggested.id}`}>
                  <Timer className="h-4 w-4" />
                  Open the test
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No mock test is published yet.</p>
          )}
        </Section>

        <Section icon={TrendingUp} title="Your skills" to="/student/progress" linkLabel="Full progress" failed={failed.progress}>
          {progress ? (
            <>
              <Skill label="Listening" skill={progress.skills.listening} />
              <Skill label="Reading" skill={progress.skills.reading} />
              <p className="text-xs text-muted-foreground">Your best score on each skill, averaged over the lesson tests and full mock tests you took.</p>
            </>
          ) : null}
        </Section>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>Also:</span>
        <Link to="/student/practice" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <Dumbbell className="h-4 w-4" />
          Practice words and listening
        </Link>
        {placement && placement.status !== PlacementStatus.NOT_STARTED ? (
          <Link to="/student/placement" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <ClipboardCheck className="h-4 w-4" />
            {placement.status === PlacementStatus.COMPLETED
              ? `Placement: ${placement.scorePercent}%, start at unit ${placement.startUnit}`
              : placement.status === PlacementStatus.SKIPPED
                ? 'Placement skipped'
                : 'Placement in progress'}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Dumbbell, GraduationCap, Headphones, PlayCircle, Sparkles, Timer, TrendingUp, Trophy } from 'lucide-react';
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
import { getProgress, getStreak } from '../api/progress-api.js';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { StreakStrip } from '../components/Streak.jsx';
import { bestMockPercent, greeting, lessonStats, nextLessonStep, suggestedMockTest } from '../lib/home.js';
import { nextKind, nextStep } from '../lib/listening-course.js';

const sources = {
  curriculum: getCurriculum,
  placement: getPlacement,
  course: getListeningCourse,
  mocks: listMockTests,
  progress: getProgress,
  streak: getStreak,
};

function Bar({ value, total, className }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className={cn('h-full rounded-full bg-primary transition-all', className)} style={{ width: `${total ? Math.min(100, (value * 100) / total) : 0}%` }} />
    </div>
  );
}

function heroOf(step, placement) {
  if (!step) return null;
  if (step.kind === 'placement') {
    const inProgress = placement?.status === PlacementStatus.IN_PROGRESS;
    return {
      icon: ClipboardCheck,
      eyebrow: 'Start here',
      title: inProgress ? 'Finish your placement test' : 'Take the placement test',
      detail: inProgress ? 'Pick up where you left off.' : 'About 25 minutes, or skip it and start at unit 1.',
      to: '/student/placement',
      action: inProgress ? 'Continue the test' : 'Go to the placement test',
    };
  }
  if (step.kind === 'lesson')
    return {
      icon: PlayCircle,
      eyebrow: `Up next · Unit ${step.unit.number}: ${step.unit.title}`,
      title: `Lesson ${step.lesson.number}: ${step.lesson.title}`,
      detail: step.lesson.bestPercent === null ? 'Vocabulary, a quiz, a fill-in, then the lesson test.' : `Your best test so far: ${step.lesson.bestPercent}%.`,
      to: `/student/lessons/${step.lesson.id}`,
      action: step.lesson.bestPercent === null ? 'Start the lesson' : 'Continue the lesson',
    };
  if (step.kind === 'done')
    return {
      icon: Trophy,
      eyebrow: 'All lessons completed',
      title: 'You finished every published lesson',
      detail: 'Keep practising with mock tests and the listening course.',
      to: '/student/mock-tests',
      action: 'Take a mock test',
      done: true,
    };
  return { icon: Sparkles, eyebrow: 'Welcome', title: 'No lessons are published yet', detail: 'Meanwhile, try the listening course.', to: '/student/listening-course', action: 'Open the listening course' };
}

function Tile({ icon: Icon, label, value, detail, children }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      {children}
    </div>
  );
}

function NextCard({ icon: Icon, tone, eyebrow, title, detail, to, action, failed, empty }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">Could not load this part.</p>
      ) : title ? (
        <>
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            {detail ? <p className="truncate text-sm text-muted-foreground">{detail}</p> : null}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-auto w-fit gap-1.5">
            <Link to={to}>
              {action}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

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

  const { curriculum, placement, course, mocks, progress, streak } = data;
  const step = nextLessonStep(curriculum);
  const hero = heroOf(step, placement);
  const lessons = lessonStats(curriculum);
  const suggested = suggestedMockTest(mocks);
  const bestMock = bestMockPercent(mocks);
  const name = account?.email?.split('@')[0] || 'learner';
  const courseNext = failed.course ? null : nextStep(course);
  const lessonPercent = lessons.total ? Math.round((lessons.completed * 100) / lessons.total) : 0;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              {greeting()}, <span className="font-medium text-foreground">{name}</span>.
            </p>
            {failed.curriculum ? (
              <div className="space-y-3">
                <p className="text-xl font-bold">Your lessons could not be loaded</p>
                <Button variant="outline" onClick={load}>
                  Try again
                </Button>
              </div>
            ) : hero ? (
              <div className="flex items-start gap-4">
                <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm', hero.done ? 'bg-success' : 'bg-primary')}>
                  <hero.icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className={cn('text-xs font-semibold uppercase tracking-widest', hero.done ? 'text-success' : 'text-primary')}>{hero.eyebrow}</p>
                  <p className="text-xl font-bold sm:text-2xl">{hero.title}</p>
                  <p className="text-sm text-muted-foreground">{hero.detail}</p>
                  <Button asChild size="lg" className="mt-3 gap-2">
                    <Link to={hero.to}>
                      {hero.action}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          {lessons.total ? (
            <div className="flex flex-col items-center gap-1 self-center">
              <ScoreRing percent={lessonPercent} tone={lessonPercent === 100 ? 'success' : 'primary'} size={128} label={`${lessons.completed}/${lessons.total} lessons`} />
            </div>
          ) : null}
        </div>
      </div>

      {streak ? <StreakStrip streak={streak} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={BookOpen} label="Lessons" value={`${lessons.completed}/${lessons.total}`} detail={lessons.currentUnit ? `Unit ${lessons.currentUnit.number}: ${lessons.currentUnit.title}` : 'completed'}>
          <div className="mt-2">
            <Bar value={lessons.completed} total={lessons.total} />
          </div>
        </Tile>
        <Tile icon={GraduationCap} label="Listening level" value={failed.course ? '—' : course?.currentLevel || '—'} detail={courseNext ? `${nextKind[courseNext.type]}: ${courseNext.title}` : 'Listening course'} />
        <Tile icon={Timer} label="Best full mock" value={bestMock === null ? '—' : `${bestMock}%`} detail={suggested ? `Suggested: level ${suggested.level}` : 'Mock tests'} />
        <Tile
          icon={TrendingUp}
          label="Listening skill"
          value={progress?.skills?.listening?.percent == null ? '—' : `${progress.skills.listening.percent}%`}
          detail={`Reading: ${progress?.skills?.reading?.percent == null ? '—' : `${progress.skills.reading.percent}%`}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NextCard
          icon={Headphones}
          tone="bg-info/15 text-info"
          eyebrow="Listening course"
          failed={failed.course}
          title={courseNext?.title}
          detail={courseNext ? `${nextKind[courseNext.type]} · ${courseNext.level}` : null}
          to={courseNext?.path}
          action="Continue listening"
          empty={course?.currentLevel ? `Every ${course.currentLevel} topic is done.` : 'Topics will appear when they are published.'}
        />
        <NextCard
          icon={Timer}
          tone="bg-warning/15 text-warning"
          eyebrow="Mock test for you"
          failed={failed.mocks}
          title={suggested?.title}
          detail={suggested ? `Level ${suggested.level}${suggested.durationMinutes ? ` · ${suggested.durationMinutes} min` : ''} · ${suggested.attemptCount ? `best ${suggested.bestPercent}%` : 'not taken yet'}` : null}
          to={suggested ? `/student/mock-tests/${suggested.id}` : '/student/mock-tests'}
          action="Open the test"
          empty="No mock test is published yet."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4 text-primary" />
              Your units
            </h2>
            <Link to="/student/lessons" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              All lessons
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {failed.curriculum ? (
            <p className="text-sm text-muted-foreground">Could not load this part.</p>
          ) : curriculum?.units?.length ? (
            <ol className="grid gap-3 sm:grid-cols-2">
              {curriculum.units.map((unit) => {
                const done = unit.lessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
                const current = lessons.currentUnit?.id === unit.id;
                const finished = unit.lessons.length > 0 && done === unit.lessons.length;
                return (
                  <li key={unit.id} className={cn('flex items-center gap-3 rounded-xl border p-3', current && 'border-primary/40 bg-primary/5')}>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold', finished ? 'bg-success/15 text-success' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {finished ? <CheckCircle2 className="h-5 w-5" /> : unit.number}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{unit.title}</span>
                        {current ? <Badge variant="info">Now</Badge> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Bar value={done} total={unit.lessons.length} className={finished ? 'bg-success' : undefined} />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {done}/{unit.lessons.length}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No lessons are published yet.</p>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Your skills
            </h2>
            <Link to="/student/progress" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Progress
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {failed.progress ? (
            <p className="text-sm text-muted-foreground">Could not load this part.</p>
          ) : progress ? (
            [
              ['Listening', progress.skills.listening, Headphones],
              ['Reading', progress.skills.reading, BookOpen],
            ].map(([label, skill, Icon]) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </span>
                  <span className="font-semibold tabular-nums">{skill.percent === null ? 'No data yet' : `${skill.percent}%`}</span>
                </div>
                <Bar value={skill.percent ?? 0} total={100} />
              </div>
            ))
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/student/practice" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground">
          <Dumbbell className="h-4 w-4" />
          Practice words and listening
        </Link>
        {placement && placement.status !== PlacementStatus.NOT_STARTED ? (
          <Link to="/student/placement" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground">
            <ClipboardCheck className="h-4 w-4" />
            {placement.status === PlacementStatus.COMPLETED
              ? `Placement: ${placement.scorePercent}%, unit ${placement.startUnit}`
              : placement.status === PlacementStatus.SKIPPED
                ? 'Placement skipped'
                : 'Placement in progress'}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

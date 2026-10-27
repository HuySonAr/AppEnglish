import { useEffect, useState } from 'react';
import { BookOpen, Brain, CheckCircle2, ClipboardCheck, Compass, Dumbbell, Headphones, Mic, PenLine, PlayCircle, Sparkles, Timer, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LessonState, PlacementStatus } from '@appenglish/learning-contracts';
import { Badge, Button } from '../../../components/ui';
import { DashboardPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { CircleSwapLink } from '../../../components/shared/CircleSwapLink.jsx';
import { CountUp } from '../../../components/shared/CountUp.jsx';
import { GlideCards } from '../../../components/shared/GlideCards.jsx';
import { GridPattern } from '../../../components/shared/GridPattern.jsx';
import { ProgressBar } from '../../../components/shared/ProgressBar.jsx';
import { RevealGroup, RevealItem } from '../../../components/shared/Reveal.jsx';
import { SectionCard } from '../../../components/shared/SectionCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { getCurriculum } from '../api/lessons-api.js';
import { listMockTests } from '../api/mock-api.js';
import { getPlacement } from '../api/placement-api.js';
import { getProgress, getStreak } from '../api/progress-api.js';
import { getStudyGoal } from '../api/goal-api.js';
import { GoalCard, TodayPlanCard } from '../components/GoalCards.jsx';
import { ScoreForecastCard, SwForecastCard } from '../components/ScoreForecastCard.jsx';
import { dailyPlan } from '../lib/study-plan.js';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { StreakCard } from '../components/Streak.jsx';
import { bestMockPercent, greeting, lessonStats, nextLessonStep, suggestedMockTest } from '../lib/home.js';

const sources = {
  curriculum: getCurriculum,
  placement: getPlacement,
  mocks: listMockTests,
  progress: getProgress,
  streak: getStreak,
  goal: getStudyGoal,
};

const practiceLinks = [
  { to: '/student/practice/vocabulary', label: 'Word memory', detail: 'Review lesson words', icon: Brain },
  { to: '/student/practice/listening', label: 'Listening', detail: 'Write what you hear', icon: Headphones, tone: 'info' },
  { to: '/student/practice/speaking', label: 'Speaking', detail: 'Speak and get a score', icon: Mic, tone: 'success' },
  { to: '/student/practice/writing', label: 'Writing', detail: 'Write and get feedback', icon: PenLine, tone: 'warning' },
];

const asPercent = (value) => `${value}%`;

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
      detail: 'Keep practising with mock tests.',
      to: '/student/mock-tests',
      action: 'Take a mock test',
    };
  return { icon: Sparkles, eyebrow: 'Welcome', title: 'No lessons are published yet', detail: 'Meanwhile, practise listening.', to: '/student/practice/listening', action: 'Open listening practice' };
}

function Stat({ icon: Icon, label, value, detail, bar }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} className="rounded-2xl border bg-background p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      {bar !== undefined ? <ProgressBar value={bar} className="mt-2.5 h-1.5" /> : null}
    </motion.div>
  );
}

function percentValue(percent) {
  return percent === null || percent === undefined ? '—' : <CountUp value={percent} format={asPercent} />;
}

function Hero({ hero, lessons, lessonPercent, failed, onRetry }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-8">
      <GridPattern className="text-primary-foreground/[0.07]" />
      <div className="relative flex h-full flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-4">
          {failed ? (
            <div className="space-y-3">
              <p className="text-2xl font-bold">Your lessons could not be loaded</p>
              <Button variant="secondary" className="rounded-full" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : hero ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium">
                <hero.icon className="h-3.5 w-3.5" />
                <span className="truncate">{hero.eyebrow}</span>
              </span>
              <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{hero.title}</h2>
              <p className="max-w-lg text-sm text-primary-foreground/80">{hero.detail}</p>
              <CircleSwapLink to={hero.to} className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                {hero.action}
              </CircleSwapLink>
            </>
          ) : null}
        </div>
        {lessons.total ? (
          <motion.div className="self-center" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}>
            <ScoreRing percent={lessonPercent} tone="inverse" size={136} label={`${lessons.completed}/${lessons.total} lessons`} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function UnitList({ curriculum, failed, currentUnitId }) {
  if (failed) return <p className="text-sm text-muted-foreground">Could not load this part.</p>;
  if (!curriculum?.units?.length) return <p className="text-sm text-muted-foreground">No lessons are published yet.</p>;
  return (
    <ol className="grid gap-2.5 sm:grid-cols-2">
      {curriculum.units.map((unit) => {
        const done = unit.lessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
        const current = currentUnitId === unit.id;
        const finished = unit.lessons.length > 0 && done === unit.lessons.length;
        return (
          <li key={unit.id} className={cn('flex items-center gap-3 rounded-2xl border bg-background p-3', current && 'border-primary/40 bg-primary/5')}>
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold', finished ? 'bg-success/15 text-success' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {finished ? <CheckCircle2 className="h-5 w-5" /> : unit.number}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{unit.title}</span>
                {current ? <Badge variant="info">Now</Badge> : null}
              </div>
              <div className="flex items-center gap-2">
                <ProgressBar value={done} total={unit.lessons.length} className="h-1.5" barClassName={finished ? 'bg-success' : undefined} />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {done}/{unit.lessons.length}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function placementText(placement) {
  if (placement.status === PlacementStatus.COMPLETED) return `Placement: ${placement.scorePercent}%, unit ${placement.startUnit}`;
  if (placement.status === PlacementStatus.SKIPPED) return 'Placement skipped';
  return 'Placement in progress';
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

  if (state === 'loading') return <DashboardPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">{greeting()}</h1>
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const { curriculum, placement, mocks, progress, streak } = data;
  const step = nextLessonStep(curriculum);
  const hero = heroOf(step, placement);
  const lessons = lessonStats(curriculum);
  const suggested = suggestedMockTest(mocks);
  const bestMock = bestMockPercent(mocks);
  const name = account?.email?.split('@')[0] || 'learner';
  const lessonPercent = lessons.total ? Math.round((lessons.completed * 100) / lessons.total) : 0;
  const skills = failed.progress ? null : progress?.skills;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <RevealGroup className="space-y-5">
      <RevealItem className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {greeting()}, <span className="text-primary">{name}</span>
          </h1>
        </div>
      </RevealItem>

      <RevealItem className={cn('grid gap-5', streak && 'lg:grid-cols-[minmax(0,1fr)_21rem]')}>
        <Hero hero={hero} lessons={lessons} lessonPercent={lessonPercent} failed={Boolean(failed.curriculum)} onRetry={load} />
        {streak ? <StreakCard streak={streak} /> : null}
      </RevealItem>

      <RevealItem className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <TodayPlanCard tasks={dailyPlan({ goal: data.goal, curriculum, mocks })} />
        <GoalCard data={data.goal} failed={Boolean(failed.goal)} onChange={(goal) => setData((current) => ({ ...current, goal }))} />
      </RevealItem>

      {data.goal?.goal?.lr ? (
        <RevealItem>
          <ScoreForecastCard data={data.goal} />
        </RevealItem>
      ) : data.goal?.goal?.sw ? (
        <RevealItem>
          <SwForecastCard />
        </RevealItem>
      ) : null}

      <RevealItem>
        <SectionCard title="Where you stand" icon={Compass} action={{ to: '/student/progress', label: 'Progress' }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Timer} label="Best full mock" value={percentValue(bestMock)} detail={suggested ? `Suggested: level ${suggested.level}` : 'Mock tests'} />
            <Stat icon={Headphones} label="Listening skill" value={percentValue(skills?.listening?.percent)} bar={skills?.listening?.percent ?? 0} />
            <Stat icon={BookOpen} label="Reading skill" value={percentValue(skills?.reading?.percent)} bar={skills?.reading?.percent ?? 0} />
          </div>
        </SectionCard>
      </RevealItem>

      <RevealItem className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <SectionCard title="Your units" icon={BookOpen} action={{ to: '/student/lessons', label: 'All lessons' }}>
          <UnitList curriculum={curriculum} failed={Boolean(failed.curriculum)} currentUnitId={lessons.currentUnit?.id} />
        </SectionCard>
        <SectionCard title="Practice" icon={Dumbbell} action={{ to: '/student/practice', label: 'All' }}>
          <GlideCards items={practiceLinks} label="Practice" />
          {placement && placement.status !== PlacementStatus.NOT_STARTED ? (
            <Link to="/student/placement" className="mt-3 flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {placementText(placement)}
            </Link>
          ) : null}
        </SectionCard>
      </RevealItem>
    </RevealGroup>
  );
}

import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, GraduationCap, Headphones, KeyRound, Lock, Mail, Pencil, Shield, Timer, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { displayNameOf } from '@appenglish/auth-contracts';
import { RoleLabels, Roles } from '../../../constants/auth.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { getProgress, getStreak, getXp } from '../../student/api/progress-api.js';
import { StreakCalendar } from '../../student/components/Streak.jsx';
import { getCourseProgress } from '../../student/api/course-api.js';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog.jsx';
import { EditProfileDialog } from '../components/EditProfileDialog.jsx';
import { LessonsRing, SkillsChart, XpChart } from '../components/ProfileCharts.jsx';
import { lessonRing, LevelStep, levelSteps, memberFor, skillBars, xpBars } from '../lib/profile-charts.js';

const eyebrows = {
  [Roles.STUDENT]: 'Student',
  [Roles.CONTENT_MANAGER]: 'Content Manager',
  [Roles.ADMIN]: 'Admin',
};
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Stat({ icon: Icon, label, value, detail, tone = 'text-primary bg-primary/10' }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-bold tabular-nums">{value}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function Panel({ title, description, action, children, className }) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function LevelSteps({ steps, currentLevel }) {
  if (!steps.length) return <p className="text-sm text-muted-foreground">The listening course has no level yet.</p>;
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step) => {
        const done = step.state === LevelStep.DONE;
        const current = step.state === LevelStep.CURRENT || step.level === currentLevel;
        return (
          <li
            key={step.level}
            className={cn(
              'flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-sm',
              done && 'border-success/40 bg-success/10',
              current && !done && 'border-primary bg-primary/10 font-semibold text-primary',
              !done && !current && 'text-muted-foreground opacity-70',
            )}
          >
            <span className="font-semibold">{step.level}</span>
            {done ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Passed" /> : current ? <span className="text-[10px] uppercase tracking-wide">Now</span> : <Lock className="h-3.5 w-3.5" aria-label="Locked" />}
            {step.topics?.total ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {step.topics.done}/{step.topics.total}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StandingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function Standing() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      const [progress, xp, course, streak] = await Promise.all([getProgress(), getXp().catch(() => null), getCourseProgress().catch(() => null), getStreak().catch(() => null)]);
      setData({ progress: progress.data, xp: xp?.data ?? null, course: course?.data ?? null, streak: streak?.data ?? null });
      setState('ready');
    } catch (error) {
      setData({ error: getApiErrorMessage(error) });
      setState('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <StandingSkeleton />;
  if (state === 'error')
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Your standing could not be loaded</p>
            <p className="text-sm text-muted-foreground">{data.error}</p>
          </div>
          <Button variant="outline" onClick={load}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  const { progress, xp, course, streak } = data;
  const ring = lessonRing(progress);
  const bars = skillBars(progress);
  const xpData = xpBars(xp);
  const steps = levelSteps(course);
  const tests = (progress.attempts?.lessonTests || 0) + (progress.attempts?.mockTests || 0);
  const nothingYet = ring.completed === 0 && tests === 0 && !xpData.length;
  const listeningLevel = course ? course.currentLevel || '—' : '—';

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat icon={BookOpen} label="Lessons completed" value={ring.total ? `${ring.completed}/${ring.total}` : '—'} detail={ring.percent === null ? 'No lesson published yet' : `${ring.percent}% of the course`} />
        <Stat icon={Trophy} label="XP" value={xp ? `${xp.totalXp} XP` : '—'} detail={xp ? (xp.rank ? `#${xp.rank} of ${xp.learnerCount} learners` : 'Finish a full mock test to earn XP') : 'XP not available'} tone="text-warning bg-warning/10" />
        <Stat icon={Headphones} label="Listening level" value={listeningLevel} detail={course ? `${course.topics?.done ?? 0}/${course.topics?.total ?? 0} course topics done` : 'Course not available'} tone="text-chart-2 bg-chart-2/10" />
        <Stat icon={Timer} label="Tests taken" value={tests} detail={`${plural(progress.attempts?.lessonTests || 0, 'lesson test')}, ${plural(progress.attempts?.mockTests || 0, 'full mock test')}`} />
      </div>

      {streak ? (
        <Panel title="Streak" description="Days of study in a row.">
          <StreakCalendar streak={streak} />
        </Panel>
      ) : null}

      {nothingYet ? (
        <EmptyState
          icon={TrendingUp}
          title="Your story starts here"
          description="Pass a lesson test or take a full mock test."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/student/lessons">
                  <BookOpen className="h-4 w-4" />
                  Go to lessons
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/student/listening-course">
                  <GraduationCap className="h-4 w-4" />
                  Listening course
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_16rem]">
            <Panel title="Mastery" description="Your best score on each skill.">
              <SkillsChart bars={bars} />
            </Panel>
            <Panel title="Lessons" description="Completed over published.">
              <LessonsRing ring={ring} />
            </Panel>
          </div>

          <Panel
            title="XP from mock tests"
            description="First full attempt of each test."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/student/leaderboard">
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </Link>
              </Button>
            }
          >
            {xpData.length ? (
              <XpChart bars={xpData} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No XP yet.{' '}
                <Link className="underline underline-offset-4" to="/student/mock-tests">
                  Take a full mock test
                </Link>{' '}
                to earn your first points.
              </p>
            )}
          </Panel>

          <Panel
            title="Listening course"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/student/listening-course/progress">
                  <GraduationCap className="h-4 w-4" />
                  Course progress
                </Link>
              </Button>
            }
          >
            {course ? <LevelSteps steps={steps} currentLevel={course.currentLevel} /> : <p className="text-sm text-muted-foreground">The listening course could not be loaded right now.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { status, account, updateAccount, restoreSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (status === 'loading' || !account) return <DetailPageSkeleton />;
  const name = displayNameOf(account);
  const since = new Date(account.createdAt);

  const student = account.role === Roles.STUDENT;
  const facts = [
    { icon: Mail, label: 'Email', value: account.email },
    { icon: CalendarDays, label: 'Member since', value: `${since.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} · ${memberFor(account.createdAt)}` },
    { icon: CheckCircle2, label: 'Account', value: account.status === 'ACTIVE' ? 'Active, email verified' : account.status, tone: 'text-success' },
  ];
  const card = (
    <Card className={cn(student && 'lg:sticky lg:top-20')}>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar account={account} size="lg" className="shadow-sm" />
          <div className="min-w-0 space-y-1.5">
            <h2 className="truncate text-xl font-bold">{name}</h2>
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" aria-hidden="true" />
              {RoleLabels[account.role]}
            </Badge>
            {!account.displayName ? <p className="text-xs text-muted-foreground">No name set yet.</p> : null}
          </div>
        </div>
        <div className="grid gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit profile
          </Button>
          <Button variant="outline" onClick={() => setChangingPassword(true)}>
            <KeyRound className="h-4 w-4" />
            Change password
          </Button>
        </div>
        <dl className="divide-y rounded-xl border text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-center gap-3 px-3 py-2.5">
              <fact.icon className={cn('h-4 w-4 shrink-0', fact.tone || 'text-muted-foreground')} aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="truncate font-medium">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );

  return (
    <section className="space-y-6">
      <PageHeader eyebrow={eyebrows[account.role]} title="Your profile" />
      {student ? (
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          {card}
          <Standing />
        </div>
      ) : (
        <div className="max-w-md">{card}</div>
      )}


      <EditProfileDialog open={editing} onOpenChange={setEditing} account={account} onSaved={updateAccount} />
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} onChanged={restoreSession} />
    </section>
  );
}

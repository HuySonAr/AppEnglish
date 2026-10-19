import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, GraduationCap, Headphones, KeyRound, Lock, Mail, Pencil, Shield, Timer, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { displayNameOf } from '@appenglish/auth-contracts';
import { CourseLevelState } from '@appenglish/learning-contracts';
import { RoleLabels, Roles } from '../../../constants/auth.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { getProgress, getXp } from '../../student/api/progress-api.js';
import { getCourseProgress } from '../../student/api/course-api.js';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog.jsx';
import { EditProfileDialog } from '../components/EditProfileDialog.jsx';
import { LessonsRing, SkillsChart, XpChart } from '../components/ProfileCharts.jsx';
import { lessonRing, levelSteps, memberFor, skillBars, xpBars } from '../lib/profile-charts.js';

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

// The levels of the listening course as steps: passed, current, locked.
function LevelSteps({ steps, currentLevel }) {
  if (!steps.length) return <p className="text-sm text-muted-foreground">The listening course has no level yet.</p>;
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step) => {
        const done = step.state === CourseLevelState.DONE;
        const current = step.state === CourseLevelState.CURRENT || step.level === currentLevel;
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
            {step.lessons ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {step.lessons.completed ?? step.lessons.passed ?? 0}/{step.lessons.total}
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

// The learner's standing (D113): stats, the two skills, the lessons ring, XP
// per mock test and the listening levels. Loaded with the page; XP and the
// course are optional and only say so when they fail.
function Standing() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      const [progress, xp, course] = await Promise.all([getProgress(), getXp().catch(() => null), getCourseProgress().catch(() => null)]);
      setData({ progress: progress.data, xp: xp?.data ?? null, course: course?.data ?? null });
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

  const { progress, xp, course } = data;
  const ring = lessonRing(progress);
  const bars = skillBars(progress);
  const xpData = xpBars(xp);
  const steps = levelSteps(course);
  const tests = (progress.attempts?.lessonTests || 0) + (progress.attempts?.mockTests || 0);
  const nothingYet = ring.completed === 0 && tests === 0 && !xpData.length;
  const listeningLevel = course ? course.currentLevel || (steps.length ? 'All passed' : '—') : '—';

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={BookOpen} label="Lessons completed" value={ring.total ? `${ring.completed}/${ring.total}` : '—'} detail={ring.percent === null ? 'No lesson published yet' : `${ring.percent}% of the course`} />
        <Stat icon={Trophy} label="XP" value={xp ? `${xp.totalXp} XP` : '—'} detail={xp ? (xp.rank ? `#${xp.rank} of ${xp.learnerCount} learners` : 'Finish a full mock test to earn XP') : 'XP not available'} tone="text-warning bg-warning/10" />
        <Stat icon={Headphones} label="Listening level" value={listeningLevel} detail={course ? `${course.lessons?.passed ?? 0}/${course.lessons?.total ?? 0} course lessons passed` : 'Course not available'} tone="text-chart-2 bg-chart-2/10" />
        <Stat icon={Timer} label="Tests taken" value={tests} detail={`${plural(progress.attempts?.lessonTests || 0, 'lesson test')}, ${plural(progress.attempts?.mockTests || 0, 'full mock test')}`} />
      </div>

      {nothingYet ? (
        <EmptyState
          icon={TrendingUp}
          title="Your story starts here"
          description="Charts fill in as you pass lesson tests, take full mock tests and move through the listening course."
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
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <Panel title="Mastery" description="Your best score on each skill's questions over every lesson test and full mock test; retakes never lower it.">
              <SkillsChart bars={bars} />
            </Panel>
            <Panel title="Lessons" description="Completed over published.">
              <LessonsRing ring={ring} />
            </Panel>
          </div>

          <Panel
            title="XP from mock tests"
            description="Only the first full attempt of each test earns XP: right answers out of 100."
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
            description="Each level opens when you pass the level test before it."
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

// The signed-in person's profile (F09, D113): a hero card with the picture,
// name and account facts; editing and the password change open on request;
// students see their standing below with charts.
export function ProfilePage() {
  const { status, account, updateAccount, restoreSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (status === 'loading' || !account) return <DetailPageSkeleton />;
  const name = displayNameOf(account);
  const since = new Date(account.createdAt);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow={eyebrows[account.role]} title="Your profile" description="How you appear to others, and where you stand." />

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/25 via-primary/10 to-chart-2/20 sm:h-28" aria-hidden="true" />
        <CardContent className="relative pb-6 pt-0">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Avatar account={account} size="lg" className="ring-4 ring-card shadow-md" />
              <div className="min-w-0 space-y-1 sm:pb-1">
                <h2 className="truncate text-2xl font-bold">{name}</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" aria-hidden="true" />
                    {RoleLabels[account.role]}
                  </Badge>
                  {!account.displayName ? <span>Shown by the first part of your email until you set a name.</span> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pb-1">
              <Button onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
              <Button variant="outline" onClick={() => setChangingPassword(true)}>
                <KeyRound className="h-4 w-4" />
                Change password
              </Button>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Email · cannot be changed</dt>
                <dd className="truncate font-medium">{account.email}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Member since</dt>
                <dd className="truncate font-medium">
                  {since.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  <span className="text-muted-foreground"> · {memberFor(account.createdAt)}</span>
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Account</dt>
                <dd className="truncate font-medium">{account.status === 'ACTIVE' ? 'Active, email verified' : account.status}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      {account.role === Roles.STUDENT ? <Standing /> : null}

      <EditProfileDialog open={editing} onOpenChange={setEditing} account={account} onSaved={updateAccount} />
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} onChanged={restoreSession} />
    </section>
  );
}

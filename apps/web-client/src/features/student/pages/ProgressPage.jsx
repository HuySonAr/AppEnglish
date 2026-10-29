import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Headphones, Timer, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getProgress, getXp } from '../api/progress-api.js';
import { ScoreRing } from '../components/ScoreRing.jsx';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function RingCard({ icon: Icon, title, percent, tone, detail }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center shadow-xs">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </p>
      <ScoreRing percent={percent} tone={tone} size={112} />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function ProgressPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [xp, setXp] = useState(null);

  async function load() {
    setState('loading');
    try {
      const [progress, xpResult] = await Promise.all([getProgress(), getXp().catch(() => null)]);
      setData(progress.data);
      setXp(xpResult?.data ?? null);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your progress', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const header = <PageHeader eyebrow="Student" title="Progress" description="Your lessons and your Listening and Reading." />;

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const { completion, skills, attempts } = data;
  const nothingYet = completion.completedLessons === 0 && attempts.lessonTests === 0 && attempts.mockTests === 0;
  const skillDetail = (skill) => (skill.testCount ? `${plural(skill.lessonTests, 'lesson test')} · ${plural(skill.mockTests, 'mock test')}` : 'No test yet');

  return (
    <section className="space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RingCard
          icon={BookOpen}
          title="Lessons"
          percent={completion.percent}
          tone={completion.percent === 100 ? 'success' : 'primary'}
          detail={completion.totalLessons ? `${completion.completedLessons} of ${plural(completion.totalLessons, 'lesson')}` : 'No lesson yet'}
        />
        <RingCard icon={Headphones} title="Listening" percent={skills.listening.percent} detail={skillDetail(skills.listening)} />
        <RingCard icon={BookOpen} title="Reading" percent={skills.reading.percent} detail={skillDetail(skills.reading)} />
        <div className="flex flex-col justify-between gap-3 rounded-2xl border bg-card p-5 shadow-xs">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Trophy className="h-4 w-4 text-warning" />
            XP
          </p>
          <div>
            <p className="text-4xl font-bold tabular-nums">{xp ? xp.totalXp : '—'}</p>
            <p className="text-xs text-muted-foreground">{xp ? (xp.rank ? `#${xp.rank} of ${xp.learnerCount} learners` : 'From your first full mock tests') : 'Could not be loaded'}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
            <Link to="/student/leaderboard">
              Leaderboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {nothingYet ? (
        <EmptyState
          icon={TrendingUp}
          title="Nothing to show yet"
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
                <Link to="/student/mock-tests">
                  <Timer className="h-4 w-4" />
                  Mock tests
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4 text-primary" />
              Lessons by unit
            </h2>
            <span className="text-xs text-muted-foreground">
              {plural(attempts.lessonTests, 'lesson test')} · {plural(attempts.mockTests, 'full mock test')} taken
            </span>
          </div>
          {completion.units.length ? (
            <ol className="grid gap-3 sm:grid-cols-2">
              {completion.units.map((unit, index) => {
                const finished = unit.total > 0 && unit.completed === unit.total;
                return (
                  <li key={unit.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold', finished ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                      {finished ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium">{unit.title}</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className={cn('h-full rounded-full transition-all', finished ? 'bg-success' : 'bg-primary')} style={{ width: `${unit.total ? (unit.completed * 100) / unit.total : 0}%` }} />
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {unit.completed}/{unit.total}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No lesson is published yet.</p>
          )}
        </div>
      )}

      {xp?.entries?.length ? (
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-warning" />
            XP from mock tests
          </h2>
          <ol className="space-y-2">
            {xp.entries.map((entry) => (
              <li key={entry.mockTestId} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                  <Timer className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{entry.mockTestTitle || 'Mock test'}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.correctCount}/{entry.totalCount} right · {new Date(entry.earnedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold tabular-nums text-warning">+{entry.xp} XP</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

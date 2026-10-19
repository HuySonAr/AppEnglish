import { useEffect, useState } from 'react';
import { BookOpen, Headphones, Timer, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getProgress, getXp } from '../api/progress-api.js';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function Bar({ completed, total }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (completed * 100) / total : 0}%` }} />
      </div>
      <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  );
}

// A skill's mastery: the average of the best score on that skill's questions
// of every lesson test and full mock test taken (D33). Before any such test
// there is no value, not 0% (D39).
function Skill({ icon, label, skill }) {
  const rests = skill.testCount
    ? `best of ${plural(skill.lessonTests, 'lesson test')} and ${plural(skill.mockTests, 'mock test')}`
    : 'Take a lesson test or a full mock test';
  return <Stat icon={icon} label={label} value={skill.percent === null ? 'No data yet' : `${skill.percent}%`} detail={rests} />;
}

// The learner's progress (F06, D33): lessons completed over the published
// lessons, and the Reading and Listening mastery. Placement, practice and
// mini tests do not count; retakes never lower it.
export function ProgressPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  // XP is shown beside the progress; without progress-service's XP answer
  // the card says so instead of hiding the page.
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

  const header = <PageHeader eyebrow="Student" title="Progress" description="How much of the course you completed, and how well you do in Listening and Reading." />;

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

  return (
    <section className="space-y-6">
      {header}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={BookOpen}
          label="Lessons completed"
          value={completion.percent === null ? 'No lessons yet' : `${completion.percent}%`}
          detail={completion.totalLessons ? `${completion.completedLessons} of ${plural(completion.totalLessons, 'lesson')}` : 'No lesson is published yet'}
        />
        <Skill icon={Headphones} label="Listening" skill={skills.listening} />
        <Skill icon={BookOpen} label="Reading" skill={skills.reading} />
        <Stat
          icon={Trophy}
          label="XP"
          value={xp ? `${xp.totalXp} XP` : '—'}
          detail={xp ? (xp.rank ? `#${xp.rank} of ${xp.learnerCount} on the leaderboard` : 'Finish a full mock test to earn XP') : 'XP could not be loaded'}
        />
      </div>

      {nothingYet ? (
        <EmptyState
          icon={TrendingUp}
          title="Nothing to show yet"
          description="Your progress grows as you pass lesson tests and take full mock tests. Placement, practice and mini tests do not count."
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
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">Lessons completed by unit</div>
            {completion.units.length ? (
              <ul className="divide-y">
                {completion.units.map((unit) => (
                  <li key={unit.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
                    <span className="font-medium">{unit.title}</span>
                    <Bar completed={unit.completed} total={unit.total} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No lesson is published yet.</p>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Mastery is the average of your best score on each skill&apos;s questions over every lesson test and full mock test you took
            ({plural(attempts.lessonTests, 'lesson test attempt')}, {plural(attempts.mockTests, 'full mock test attempt')}). Retaking a test never lowers it.
          </p>
        </>
      )}

      {xp?.entries?.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">
            <span>XP from mock tests (first full attempt of each)</span>
            <Link to="/student/leaderboard" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Trophy className="h-4 w-4" />
              Leaderboard
            </Link>
          </div>
          <ul className="divide-y">
            {xp.entries.map((entry) => (
              <li key={entry.mockTestId} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{entry.mockTestTitle || 'Mock test'}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.correctCount}/{entry.totalCount} right · {new Date(entry.earnedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">+{entry.xp} XP</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

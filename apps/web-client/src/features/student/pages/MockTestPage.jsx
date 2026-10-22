import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, FileText, Headphones, History, ListChecks, Minus, Sigma, TrendingDown, TrendingUp } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MockAttemptKind, TestTrend } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import {
  discardMockAttempt,
  getMockAttempt,
  getMockTest,
  saveMockAnswers,
  startMockAttempt,
  submitMockAttempt,
} from '../api/mock-api.js';
import { TestExam } from '../components/TestExam.jsx';
import { TestStartCard } from '../components/TestStartCard.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';

const FULL = { kind: MockAttemptKind.FULL };
const mini = (partKey) => ({ kind: MockAttemptKind.MINI, partKey });
const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };
const trendIcons = {
  [TestTrend.IMPROVED]: { icon: TrendingUp, tone: 'text-success', label: 'Improving' },
  [TestTrend.DECLINED]: { icon: TrendingDown, tone: 'text-destructive', label: 'Went down' },
  [TestTrend.UNCHANGED]: { icon: Minus, tone: 'text-muted-foreground', label: 'Same as before' },
};

export function MockTestPage() {
  const { mockTestId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [exam, setExam] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setData((await getMockTest(mockTestId)).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the mock test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    setExam(null);
    load();
  }, [mockTestId]);

  useEffect(() => {
    const partKey = location.state?.startMini;
    const full = location.state?.startFull;
    if (!partKey && !full) return;
    navigate(location.pathname, { replace: true, state: null });
    onStart(full ? FULL : mini(partKey));
  }, [location.state]);

  async function onStart(reference) {
    setBusy(true);
    try {
      setExam((await startMockAttempt(mockTestId, reference)).data);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not start the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(answers) {
    const reference = exam.partKey ? mini(exam.partKey) : FULL;
    setBusy(true);
    try {
      const result = (await submitMockAttempt(mockTestId, reference, answers)).data;
      const shown = result.attempt ? `?attempt=${result.attempt.attemptNumber}` : '';
      navigate(`/student/mock-tests/${mockTestId}/${reference.partKey ? `mini/${reference.partKey}` : 'history'}${shown}`);
      return;
    } catch (error) {
      notify({ title: 'Could not submit the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      // The attempt is over either way (submitted, or its time ran out).
      setExam(null);
      await load({ quiet: true });
      setBusy(false);
      window.scrollTo({ top: 0 });
    }
  }

  // Leaving without submitting: the attempt is thrown away (D82), or a mini
  // test is kept to resume. A mini test goes back to the history page of its
  // part, the full test to this page. True when the learner left.
  async function onLeave(discard) {
    const reference = exam.partKey ? mini(exam.partKey) : FULL;
    try {
      if (discard) await discardMockAttempt(mockTestId, reference);
    } catch (error) {
      notify({ title: 'Could not leave the test', description: getApiErrorMessage(error), variant: 'destructive' });
      // The attempt may be over already (its time ran out).
      setExam(null);
      await load({ quiet: true });
      return false;
    }
    if (reference.partKey) {
      navigate(`/student/mock-tests/${mockTestId}/mini/${reference.partKey}`);
      return true;
    }
    setExam(null);
    await load({ quiet: true });
    window.scrollTo({ top: 0 });
    return true;
  }

  async function onResume(reference) {
    setBusy(true);
    try {
      const attempt = (await getMockAttempt(mockTestId, reference)).data;
      if (attempt.status === 'IN_PROGRESS') {
        setExam(attempt);
        window.scrollTo({ top: 0 });
      } else await load({ quiet: true });
    } catch (error) {
      notify({ title: 'Could not resume the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/student/mock-tests">
          Back to mock tests
        </Link>
      </div>
    );

  if (exam)
    return (
      <TestExam
        name={exam.partKey ? 'mini test' : 'mock test'}
        retakeAllowed
        attempt={exam}
        saveAnswers={(answers) => saveMockAnswers(mockTestId, exam.partKey ? mini(exam.partKey) : FULL, answers)}
        submitting={busy}
        onSubmit={onSubmit}
        onDiscard={() => onLeave(true)}
        onLeaveForLater={exam.partKey ? () => onLeave(false) : undefined}
      />
    );

  const { mockTest, full, parts } = data;
  const latestFull = full.attempts.at(-1);
  const groups = ['LISTENING', 'READING'].map((skill) => ({ skill, parts: parts.filter((part) => part.skill === skill) })).filter((group) => group.parts.length);

  return (
    <section className="space-y-8">
      <Link to="/student/mock-tests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Mock tests
      </Link>

      <TestStartCard
        icon={FileText}
        eyebrow={`Level ${mockTest.level} · full test`}
        title={mockTest.title}
        badges={full.inProgress ? <Badge variant="warning">In progress</Badge> : null}
        stats={[
          { icon: ListChecks, label: 'Questions', value: mockTest.questionCount },
          { icon: Clock, label: 'Minutes', value: mockTest.durationMinutes },
          { icon: History, label: 'Attempts', value: full.attempts.length },
          { icon: Sigma, label: 'Latest estimate', value: latestFull?.estimated ? latestFull.estimated.totalScore : '—' },
        ]}
        note="Scores on the 990 scale are estimates. Your first full attempt counts for XP."
      >
        {full.inProgress ? (
          <Button size="lg" disabled={busy} onClick={() => onResume(FULL)}>
            Resume the full test
          </Button>
        ) : (
          <Button size="lg" disabled={busy} onClick={() => onStart(FULL)}>
            {full.attempts.length ? 'Take the full test again' : 'Start the full test'}
          </Button>
        )}
        {full.attempts.length ? (
          <Button asChild size="lg" variant="outline" className="gap-1.5">
            <Link to={`/student/mock-tests/${mockTestId}/history`}>
              <History className="h-4 w-4" />
              History ({full.attempts.length})
            </Link>
          </Button>
        ) : null}
      </TestStartCard>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Mini tests</h2>
          <p className="text-sm text-muted-foreground">One part at a time, no time limit.</p>
        </div>
        {groups.map((group) => (
          <div key={group.skill} className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              {group.skill === 'LISTENING' ? <Headphones className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              {skillLabels[group.skill]}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {group.parts.map((part) => {
                const latest = part.mini.attempts.at(-1);
                const trend = part.mini.progression ? trendIcons[part.mini.progression.trend] : null;
                return (
                  <li key={part.key} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{part.number}</span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight">{part.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {part.questionCount} question{part.questionCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{latest ? 'Latest' : 'Not taken yet'}</span>
                        {latest ? (
                          <span className="flex items-center gap-1.5 font-bold tabular-nums">
                            {trend ? <trend.icon className={cn('h-4 w-4', trend.tone)} aria-label={trend.label} /> : null}
                            {latest.scorePercent}%
                          </span>
                        ) : null}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${latest ? latest.scorePercent : 0}%` }} />
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      {part.mini.inProgress ? (
                        <Button size="sm" disabled={busy} onClick={() => onResume(mini(part.key))}>
                          Resume
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy || !part.questionCount} onClick={() => onStart(mini(part.key))}>
                          {latest ? 'Again' : 'Start'}
                        </Button>
                      )}
                      {part.mini.attempts.length ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/student/mock-tests/${mockTestId}/mini/${part.key}`}>History ({part.mini.attempts.length})</Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

    </section>
  );
}

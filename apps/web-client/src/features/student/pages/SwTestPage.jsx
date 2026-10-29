import { useEffect, useState } from 'react';
import { ChevronRight, Clock, History, ListChecks, Mic, MicVocal, PenLine } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SwSection } from '@appenglish/content-contracts';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { SectionCard } from '../../../components/shared/SectionCard.jsx';
import { Button } from '../../../components/ui';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
import { discardSwAttempt, getSwTest, startSwAttempt } from '../api/sw-test-api.js';
import { ConfirmDialog } from '../components/SwExamParts.jsx';
import { MicCheck, SwSpeakingExam } from '../components/SwSpeakingExam.jsx';
import { SwWritingExam } from '../components/SwWritingExam.jsx';
import { TestStartCard } from '../components/TestStartCard.jsx';
import { sectionInfo, writingMinutes } from '../lib/sw-exam.js';
import { swResultPath } from '../lib/sw-score.js';
import { SwAttemptBadge } from '../components/SwScoreParts.jsx';

const HISTORY_PAGE_SIZE = 5;
const dateText = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function AttemptHistory({ testId, section, history, total, page, onPage }) {
  const attempts = [...history.attempts].reverse();
  const shown = paginate(attempts, page, HISTORY_PAGE_SIZE);
  if (!attempts.length) return <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Not taken yet.</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
        {shown.items.map((attempt) => (
          <li key={attempt.attemptNumber}>
            <Link
              to={swResultPath(testId, section, attempt.attemptNumber)}
              className="group flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Attempt {attempt.attemptNumber}</span>
                <span className="block text-xs text-muted-foreground">
                  {dateText(attempt.submittedAt)} · {attempt.answered} of {total} answered
                </span>
              </span>
              <SwAttemptBadge attempt={attempt} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="attempt" onChange={onPage} />
    </div>
  );
}

export function SwTestPage() {
  const { swTestId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [exam, setExam] = useState(null);
  const [stage, setStage] = useState(null);
  const [starting, setStarting] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setData((await getSwTest(swTestId)).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    setExam(null);
    setStage(null);
    load();
  }, [swTestId]);

  useEffect(() => {
    const section = location.state?.start;
    if (!section) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    setStage(section);
  }, [location.state]);

  async function start(section) {
    setStarting(true);
    try {
      setExam((await startSwAttempt(swTestId, section)).data);
      setStage(null);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not start the test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  }

  function onDone(result) {
    navigate(swResultPath(swTestId, exam.section, result?.attempt?.attemptNumber), { replace: true });
  }

  function onExpired() {
    notify({ title: 'Time is up', description: 'Your answers so far were saved.', variant: 'warning' });
    navigate(swResultPath(swTestId, exam.section), { replace: true });
  }

  async function onDiscard() {
    try {
      await discardSwAttempt(swTestId, exam.section);
    } catch (error) {
      notify({ title: 'Could not leave the test', description: getApiErrorMessage(error), variant: 'destructive' });
      return false;
    }
    setExam(null);
    await load({ quiet: true });
    window.scrollTo({ top: 0 });
    return true;
  }

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/student/sw-tests">
          Back to S&W tests
        </Link>
      </div>
    );

  if (exam?.section === SwSection.SPEAKING) return <SwSpeakingExam key={exam.attemptNumber} testId={swTestId} attempt={exam} onDone={onDone} onExpired={onExpired} onDiscard={onDiscard} />;
  if (exam?.section === SwSection.WRITING) return <SwWritingExam key={exam.attemptNumber} testId={swTestId} attempt={exam} onDone={onDone} onExpired={onExpired} onDiscard={onDiscard} />;
  if (stage === SwSection.SPEAKING) return <MicCheck starting={starting} onStart={() => start(SwSection.SPEAKING)} onCancel={() => setStage(null)} />;

  const { swTest, speaking, writing } = data;
  const pageOf = (key) => Math.max(1, Number.parseInt(params.get(key) || '1', 10) || 1);
  const setPageOf = (key) => (page) => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set(key, String(page));
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const sections = [
    { key: SwSection.SPEAKING, icon: Mic, history: speaking, total: swTest.speakingCount || sectionInfo.speaking.questions, note: 'Check your microphone first.', pageKey: 'sp' },
    { key: SwSection.WRITING, icon: PenLine, history: writing, total: swTest.writingCount || sectionInfo.writing.questions, note: `${writingMinutes()} minutes in four timed parts.`, pageKey: 'wp' },
  ];

  return (
    <section className="space-y-8">
      <PageBreadcrumb items={[{ label: 'S&W tests', to: '/student/sw-tests' }, { label: swTest.title }]} />

      <TestStartCard
        icon={MicVocal}
        eyebrow="Speaking & Writing test"
        title={swTest.title}
        stats={[
          { icon: Mic, label: 'Speaking', value: `${swTest.speakingCount} Q` },
          { icon: PenLine, label: 'Writing', value: `${swTest.writingCount} Q` },
          { icon: Clock, label: 'Writing minutes', value: writingMinutes() },
          { icon: History, label: 'Attempts', value: speaking.attempts.length + writing.attempts.length },
        ]}
        note="Each part runs without a pause, in the real exam order."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <SectionCard
            key={section.key}
            title={sectionInfo[section.key].label}
            icon={section.icon}
            aside={
              <Button disabled={starting} onClick={() => setStage(section.key)}>
                Take {sectionInfo[section.key].label}
              </Button>
            }
          >
            <div className="space-y-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ListChecks className="h-4 w-4" />
                {section.total} questions · {section.note}
              </p>
              <AttemptHistory testId={swTestId} section={section.key} history={section.history} total={section.total} page={pageOf(section.pageKey)} onPage={setPageOf(section.pageKey)} />
            </div>
          </SectionCard>
        ))}
      </div>

      <ConfirmDialog
        open={stage === SwSection.WRITING}
        onOpenChange={(open) => !open && !starting && setStage(null)}
        title="Start the Writing test?"
        description={`${swTest.writingCount} questions, ${writingMinutes()} minutes, no pause.`}
        confirmLabel="Start"
        cancelLabel="Cancel"
        onConfirm={() => start(SwSection.WRITING)}
      />
    </section>
  );
}

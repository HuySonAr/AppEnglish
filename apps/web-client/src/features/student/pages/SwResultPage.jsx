import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, Gauge, GraduationCap, KeyRound, ListChecks, Loader2, MicVocal, RotateCcw, Send, Sigma } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SwSection } from '@appenglish/content-contracts';
import { SwScoringStatus } from '@appenglish/learning-contracts';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Badge, Button } from '../../../components/ui';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { requestSwReview, withdrawReview } from '../api/review-api.js';
import { getSwResult, retrySwScoring } from '../api/sw-test-api.js';
import { SwPrompt, TaskHeading } from '../components/SwExamParts.jsx';
import { SpeakingAnswer, SwItemDetails, SwItemScore, SwStatusNotice, WritingAnswer } from '../components/SwScoreParts.jsx';
import { Waiting } from '../components/TeacherReviewPanel.jsx';
import { TestStartCard } from '../components/TestStartCard.jsx';
import { sectionInfo } from '../lib/sw-exam.js';
import { SW_POLL_MS, canRetry, canSendToTeacher, isScoring, rawText, retryErrorText, reviewErrorText, shownFinal, swBandInfo } from '../lib/sw-score.js';

const dateText = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function ScoreBand({ section, final, reviewed }) {
  const band = swBandInfo(section, final.scaled, final.band);
  if (!band) return null;
  const levels = section === SwSection.SPEAKING ? [['Pronunciation', final.pronunciationLevel], ['Intonation & stress', final.intonationLevel]].filter(([, value]) => value) : [];
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl border bg-background p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          Level {band.level} of {band.levels} · {band.range}
          {reviewed ? '' : ' · Estimated'}
        </p>
        <p className="text-sm font-medium">{band.description}</p>
      </div>
      {levels.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-muted px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">{label}: </span>
          <span className="font-semibold">{value}</span>
        </div>
      ))}
    </div>
  );
}

function TeacherPart({ data, section, swTestId, onChange }) {
  const [busy, setBusy] = useState(false);
  const { attempt, review, reviewQuota, teacherReview } = data;

  if (teacherReview)
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="success" className="gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            Reviewed by teacher
          </Badge>
          {teacherReview.reviewedAt ? <span className="text-xs text-muted-foreground">{new Date(teacherReview.reviewedAt).toLocaleDateString()}</span> : null}
        </div>
        {teacherReview.note ? <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">{teacherReview.note}</p> : <p className="text-sm text-muted-foreground">The teacher agreed with the AI score.</p>}
      </div>
    );

  async function run(action, done, failTitle, errorText) {
    setBusy(true);
    try {
      await action();
      notify({ title: done });
      await onChange();
    } catch (error) {
      notify({ title: failTitle, description: errorText(error, getApiErrorMessage(error)), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (review?.status === 'WAITING' || review?.status === 'IN_REVIEW')
    return <Waiting status={review.status} busy={busy} onWithdraw={() => run(() => withdrawReview(attempt.id), 'Taken back; your turn is free again', 'Could not take it back', (_, text) => text)} />;
  if (!canSendToTeacher(data, section)) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm">
      <GraduationCap className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1">
        {review?.status === 'EXPIRED' ? 'No teacher was free in time, so your turn is back. ' : ''}
        {reviewQuota.left} of {reviewQuota.limit} teacher reviews left this week.
      </span>
      <Button
        size="sm"
        className="gap-1.5"
        loading={busy}
        disabled={reviewQuota.left === 0}
        onClick={() => run(() => requestSwReview(swTestId, section, attempt.attemptNumber), 'Sent to a teacher', 'Could not send it', reviewErrorText)}
      >
        <Send className="h-4 w-4" />
        Send to a teacher
      </Button>
    </div>
  );
}

export function SwResultPage() {
  const { swTestId } = useParams();
  const [params] = useSearchParams();
  const section = params.get('section') === SwSection.WRITING ? SwSection.WRITING : SwSection.SPEAKING;
  const attemptNumber = Number.parseInt(params.get('attempt') || '', 10) || undefined;
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const timer = useRef(null);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setData((await getSwResult(swTestId, section, attemptNumber)).data);
      setState('ready');
    } catch (error) {
      if (quiet) return;
      setState('error');
      notify({ title: 'Could not load the result', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [swTestId, section, attemptNumber]);

  useEffect(() => {
    if (!isScoring(data)) return undefined;
    timer.current = setTimeout(() => load({ quiet: true }), SW_POLL_MS);
    return () => clearTimeout(timer.current);
  }, [data]);

  async function retry() {
    setRetrying(true);
    try {
      setData((await retrySwScoring(swTestId, section, data.attempt.attemptNumber)).data);
    } catch (error) {
      notify({ title: 'Could not score it again', description: retryErrorText(error, getApiErrorMessage(error)), variant: 'destructive' });
    } finally {
      setRetrying(false);
    }
  }

  const testPath = `/student/sw-tests/${swTestId}`;
  const label = sectionInfo[section].label;

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={testPath}>
          Back to the test
        </Link>
      </div>
    );

  if (!data.attempt)
    return (
      <section className="space-y-6">
        <PageBreadcrumb items={[{ label: 'S&W tests', to: '/student/sw-tests' }, { label: 'Test', to: testPath }, { label }]} />
        <EmptyState
          icon={MicVocal}
          title="No attempt found"
          description={`Take the ${label} part to see your answers here.`}
          action={
            <Button asChild variant="outline">
              <Link to={testPath}>Open the test</Link>
            </Button>
          }
        />
      </section>
    );

  const { attempt, items, scoring } = data;
  const Answer = section === SwSection.SPEAKING ? SpeakingAnswer : WritingAnswer;
  const { final, reviewed } = shownFinal(data);
  const status = scoring?.status;
  const retryButton = canRetry(data) ? (
    <Button size="sm" variant="outline" className="gap-1.5" loading={retrying} onClick={retry}>
      <RotateCcw className="h-4 w-4" />
      Score again
    </Button>
  ) : null;
  const headerBadge = reviewed ? (
    <Badge variant="success" className="gap-1">
      <GraduationCap className="h-3.5 w-3.5" />
      Reviewed by teacher
    </Badge>
  ) : final ? (
    <Badge variant="secondary">Estimated</Badge>
  ) : status === SwScoringStatus.SCORING ? (
    <Badge variant="info">Scoring…</Badge>
  ) : (
    <Badge variant="outline">Not scored yet</Badge>
  );

  return (
    <section className="space-y-6">
      <PageBreadcrumb items={[{ label: 'S&W tests', to: '/student/sw-tests' }, { label: attempt.title, to: testPath }, { label: `${label} · attempt ${attempt.attemptNumber}` }]} />

      <TestStartCard
        icon={MicVocal}
        eyebrow={`${label} · attempt ${attempt.attemptNumber}`}
        title={attempt.title}
        badges={headerBadge}
        stats={[
          { icon: Gauge, label: reviewed ? 'Score (0–200)' : 'Estimated (0–200)', value: final ? final.scaled : '—', tone: final ? 'text-primary' : undefined },
          { icon: Sigma, label: 'Raw score', value: rawText(final, section) },
          { icon: ListChecks, label: 'Answered', value: `${attempt.answered}/${items.length}` },
          { icon: CalendarClock, label: 'Submitted', value: dateText(attempt.submittedAt), tone: 'text-base' },
        ]}
      >
        {final ? <ScoreBand section={section} final={final} reviewed={reviewed} /> : null}
        <Button asChild variant="outline">
          <Link to={testPath}>Back to the test</Link>
        </Button>
      </TestStartCard>

      {!reviewed && status === SwScoringStatus.SCORING ? <SwStatusNotice icon={Loader2} spin title="Scoring your answers…" /> : null}
      {!reviewed && status === SwScoringStatus.FAILED ? (
        <SwStatusNotice tone="destructive" icon={AlertCircle} title="Some answers could not be scored" action={retryButton}>
          {scoring.error || 'Check your Gemini key, then score again.'}
        </SwStatusNotice>
      ) : null}
      {!reviewed && status === SwScoringStatus.NO_KEY ? (
        <SwStatusNotice icon={KeyRound} title="Not scored" action={retryButton}>
          <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
            Add your Gemini key
          </Link>
          , then score again.
        </SwStatusNotice>
      ) : null}

      <TeacherPart data={data} section={section} swTestId={swTestId} onChange={() => load({ quiet: true })} />

      <ol className="space-y-4">
        {items.map((item) => (
          <li key={item.number} className="space-y-4 rounded-3xl border bg-card p-5 shadow-xs sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <TaskHeading item={item} />
              <SwItemScore item={item} reviewed={reviewed} />
            </div>
            <SwPrompt item={item} compact showText={Boolean(item.text)} />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your answer</p>
              <Answer item={item} />
            </div>
            <SwItemDetails item={item} reviewed={reviewed} />
          </li>
        ))}
      </ol>
    </section>
  );
}

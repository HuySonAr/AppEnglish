import { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, RotateCcw, Trophy, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { answerMistake, getMistakePractice, getMockMistakes } from '../api/mock-api.js';

const letters = ['A', 'B', 'C', 'D'];

function StreakDots({ streak, need }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${streak} of ${need} right in a row`}>
      {Array.from({ length: need }, (_, index) => (
        <span key={index} className={cn('h-2 w-6 rounded-full', index < streak ? 'bg-success' : 'bg-muted')} />
      ))}
    </span>
  );
}

function QuestionView({ question, result, busy, onPick, need }) {
  const chosen = result?.optionId;
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          Part {question.partNumber} · {question.partTitle}
        </Badge>
        <span className="text-muted-foreground">
          Question {question.number}
          {question.mockTestTitle ? ` · ${question.mockTestTitle}` : ''}
        </span>
        <span className="ml-auto">
          <StreakDots streak={result ? result.streak : question.streak} need={need} />
        </span>
      </div>
      {question.audioUrl ? <audio controls src={question.audioUrl} className="w-full" /> : null}
      {question.passageImageUrl ? <img src={question.passageImageUrl} alt="" className="max-h-72 rounded-lg border" /> : null}
      {question.passage ? (
        <div className="max-h-80 overflow-y-auto rounded-xl border bg-background p-4 text-sm leading-relaxed">
          <PassageText text={question.passage} />
        </div>
      ) : null}
      {question.imageUrl ? <img src={question.imageUrl} alt="" className="max-h-72 rounded-lg border" /> : null}
      {question.prompt ? <p className="font-medium">{question.prompt}</p> : null}
      <div className={cn('grid gap-2', question.lettersOnly && 'grid-cols-4')}>
        {question.options.map((option, index) => {
          const right = result && option.id === result.correctOptionId;
          const wrong = result && option.id === chosen && !result.correct;
          return (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(result) || busy}
              onClick={() => onPick(option.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                !result && 'hover:bg-accent',
                right && 'border-success bg-success/10',
                wrong && 'border-destructive bg-destructive/10',
                question.lettersOnly && 'justify-center',
              )}
            >
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold', right ? 'bg-success text-white' : wrong ? 'bg-destructive text-white' : 'bg-muted')}>
                {right ? <Check className="h-4 w-4" /> : wrong ? <X className="h-4 w-4" /> : letters[index]}
              </span>
              {question.lettersOnly ? null : <span>{option.text}</span>}
            </button>
          );
        })}
      </div>
      {result ? (
        <div className={cn('space-y-2 rounded-xl border p-4 text-sm', result.correct ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5')}>
          <p className="font-semibold">{result.cleared ? 'Cleared from your list.' : result.correct ? 'Right. One more time to clear it.' : 'Not this time.'}</p>
          {result.explanation ? <p className="text-muted-foreground">{result.explanation}</p> : null}
          {result.transcript ? (
            <details>
              <summary className="cursor-pointer text-primary">Transcript</summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{result.transcript}</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MockMistakesPage() {
  const [state, setState] = useState('loading');
  const [summary, setSummary] = useState(null);
  const [part, setPart] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setState('loading');
    try {
      setSummary((await getMockMistakes()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your mistakes', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function start() {
    setBusy(true);
    try {
      const { questions } = (await getMistakePractice(part)).data;
      setSession({ questions, index: 0, results: {} });
    } catch (error) {
      notify({ title: 'Could not start the review', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function pick(optionId) {
    const question = session.questions[session.index];
    setBusy(true);
    try {
      const result = (await answerMistake(question.questionId, optionId)).data;
      setSession((current) => ({ ...current, results: { ...current.results, [question.questionId]: { ...result, optionId } } }));
    } catch (error) {
      notify({ title: 'Could not check the answer', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setSession(null);
    await load();
  }

  const breadcrumb = <PageBreadcrumb items={[{ label: 'Mock tests', to: '/student/mock-tests' }, { label: 'Review my mistakes' }]} />;
  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-4">
        {breadcrumb}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  if (session) {
    const done = session.index >= session.questions.length;
    const results = Object.values(session.results);
    if (done || !session.questions.length)
      return (
        <section className="space-y-6">
          {breadcrumb}
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-xs">
            <Trophy className="h-10 w-10 text-success" />
            <p className="text-xl font-bold">Review finished</p>
            <p className="text-muted-foreground tabular-nums">
              {results.filter((item) => item.correct).length} of {results.length} right · {results.filter((item) => item.cleared).length} cleared
            </p>
            <Button className="mt-2 gap-1.5" onClick={finish}>
              <RotateCcw className="h-4 w-4" />
              Back to my list
            </Button>
          </div>
        </section>
      );
    const question = session.questions[session.index];
    const result = session.results[question.questionId];
    return (
      <section className="space-y-4">
        {breadcrumb}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium tabular-nums">
            Question {session.index + 1} of {session.questions.length}
          </p>
          <Button variant="ghost" size="sm" onClick={finish}>
            Stop
          </Button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(session.index * 100) / session.questions.length}%` }} />
        </div>
        <QuestionView key={question.questionId} question={question} result={result} busy={busy} onPick={pick} need={summary.clearStreak} />
        {result ? (
          <div className="flex justify-end">
            <Button className="gap-1.5" onClick={() => setSession((current) => ({ ...current, index: current.index + 1 }))}>
              {session.index + 1 === session.questions.length ? 'See the result' : 'Next question'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  const parts = summary.parts.filter((item) => item.count > 0);
  return (
    <section className="space-y-6">
      {breadcrumb}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Mock tests</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Review my mistakes</h1>
        <p className="text-muted-foreground">A question leaves the list after {summary.clearStreak} right answers in a row.</p>
      </div>
      {summary.total === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to review"
          description="Questions you get wrong in mock tests will wait here."
          action={
            <Button asChild variant="outline">
              <Link to="/student/mock-tests">Go to mock tests</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-3xl font-bold tabular-nums">
            {summary.total}
            <span className="text-base font-medium text-muted-foreground"> question{summary.total === 1 ? '' : 's'} to review</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {[{ key: null, label: 'All parts', count: summary.total }, ...parts.map((item) => ({ key: item.key, label: `Part ${item.number}`, count: item.count }))].map((item) => (
              <button
                key={item.key || 'all'}
                type="button"
                aria-pressed={part === item.key}
                onClick={() => setPart(item.key)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                  part === item.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                {item.label}
                <span className={cn('rounded-full px-1.5 text-xs tabular-nums', part === item.key ? 'bg-primary-foreground/20' : 'bg-muted')}>{item.count}</span>
              </button>
            ))}
          </div>
          <Button size="lg" className="gap-1.5" loading={busy} disabled={busy} onClick={start}>
            Start review
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

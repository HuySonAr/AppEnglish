import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, LogOut, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  Button,
} from '../../../components/ui';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { setLeaveGuard } from '../../../lib/leave-guard.js';
import { cn } from '../../../lib/utils.js';
import { answeredCount, formatRemaining, numberBlanks, partSections, remainingTime } from '../lib/placement.js';
import { AnswerProgress } from './AnswerProgress.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };

export function Question({ question, chosen, onChoose, blankNumber, showAudio = true }) {
  return (
    <fieldset
      id={`question-${question.number}`}
      className={cn('scroll-mt-36 rounded-2xl border-2 bg-card p-4 shadow-sm transition-colors sm:p-5', chosen ? 'border-primary/30' : 'border-transparent')}
    >
      <legend className="sr-only">Question {question.number}</legend>
      <p className="flex items-start gap-3 font-medium">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums', chosen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          {question.number}
        </span>
        <span className="pt-1">{question.prompt || (blankNumber ? `Blank (${question.number})` : 'Choose the best answer.')}</span>
      </p>
      {showAudio && question.audioUrl ? <audio controls src={question.audioUrl} className="mt-4 w-full" /> : null}
      {question.imageUrl ? <img src={question.imageUrl} alt="" className="mt-4 max-h-80 rounded-xl border" /> : null}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const selected = chosen === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring',
                selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                className="sr-only"
                checked={selected}
                onChange={() => onChoose(question.id, option.id)}
              />
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                  selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {optionLetters[index]}
              </span>
              {option.text ? <span>{option.text}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function useExamLeaveGuard(onLeave) {
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  useEffect(() => {
    const removeGuard = setLeaveGuard(() => leaveRef.current());
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank') return;
      event.preventDefault();
      event.stopPropagation();
      leaveRef.current();
    };
    window.history.pushState(null, '', window.location.href);
    const onBack = () => {
      window.history.pushState(null, '', window.location.href);
      leaveRef.current();
    };
    const onUnload = (event) => event.preventDefault();
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onBack);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      removeGuard();
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onBack);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}

export function TestExam({ attempt, saveAnswers, onSubmit, submitting, name, retakeAllowed = false, onDiscard, onLeaveForLater, phaseLabel }) {
  const [answers, setAnswers] = useState(attempt.answers || {});
  const [partIndex, setPartIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [offset] = useState(() => new Date(attempt.serverNow).getTime() - Date.now());
  const [remaining, setRemaining] = useState(() => remainingTime(attempt.expiresAt, offset));
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submitted = useRef(false);

  useEffect(() => {
    if (!attempt.expiresAt) return undefined;
    const timer = setInterval(() => {
      const left = remainingTime(attempt.expiresAt, offset);
      setRemaining(left);
      if (left <= 0 && !submitted.current) {
        submitted.current = true;
        onSubmit(answersRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt.expiresAt, offset]);

  useEffect(() => {
    if (answers === attempt.answers) return undefined;
    const timer = setTimeout(() => saveAnswers(answers).catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [answers]);

  useEffect(() => {
    if (target === null) window.scrollTo({ top: 0 });
    else document.getElementById(`question-${target.number}`)?.scrollIntoView({ block: 'start' });
  }, [partIndex, target]);

  function showPart(index) {
    setTarget(null);
    setPartIndex(index);
  }
  function showQuestion(index, number) {
    setPartIndex(index);
    setTarget({ number });
  }

  useExamLeaveGuard(() => setLeaving(true));

  async function discard() {
    submitted.current = true;
    setDiscarding(true);
    const done = await onDiscard();
    if (!done) {
      submitted.current = false;
      setDiscarding(false);
    }
  }

  const leaveButtons = (
    <>
      {onLeaveForLater ? (
        <Button variant="outline" disabled={discarding} onClick={onLeaveForLater}>
          Leave and continue later
        </Button>
      ) : null}
      {onDiscard ? (
        <Button variant="destructive" loading={discarding} disabled={discarding} onClick={discard}>
          Discard and leave
        </Button>
      ) : null}
    </>
  );

  const choose = (questionId, optionId) =>
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  const part = attempt.parts[partIndex];
  const total = attempt.parts.reduce((sum, item) => sum + item.questions.length, 0);
  const answered = answeredCount(attempt.parts, answers);
  const unanswered = attempt.parts
    .flatMap((item) => item.questions)
    .filter((question) => !answers[question.id])
    .map((question) => question.number);
  const lowTime = remaining <= 2 * 60 * 1000;

  return (
    <section className="space-y-6">
      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {phaseLabel ? <span className="rounded-full border px-3 py-1.5 text-sm font-semibold">{phaseLabel}</span> : null}
        {attempt.expiresAt ? (
          <span
            role="timer"
            aria-label="Time left"
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums',
              lowTime ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
            )}
          >
            <Clock className="h-4 w-4" />
            {formatRemaining(remaining)}
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            <Clock className="h-4 w-4" />
            No time limit
          </span>
        )}
        <div className="flex min-w-[10rem] flex-1 items-center gap-2 sm:max-w-xs">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? (answered * 100) / total : 0}%` }} />
          </div>
          <span className="text-sm font-medium tabular-nums">
            <span className="font-bold text-primary">{answered}</span>/{total}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onDiscard ? (
            <Button variant="outline" disabled={submitting || discarding} onClick={() => setExiting(true)}>
              <LogOut className="h-4 w-4" />
              Exit
            </Button>
          ) : null}
          <Button loading={submitting} disabled={submitting || discarding} onClick={() => setConfirming(true)}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <aside className="lg:order-2 lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Questions</p>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-primary" /> Answered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border border-input" /> Not answered
                </span>
              </p>
            </div>
            <ol
              aria-label="Questions"
              className="flex max-h-40 flex-wrap gap-2 overflow-y-auto p-0.5 lg:grid lg:max-h-[60vh] lg:grid-cols-5"
            >
              {attempt.parts.map((item, index) =>
                item.questions.map((question) => {
                  const done = Boolean(answers[question.id]);
                  return (
                    <li key={question.id}>
                      <button
                        type="button"
                        aria-label={`Question ${question.number}, ${done ? 'answered' : 'not answered'}`}
                        onClick={() => showQuestion(index, question.number)}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          done
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input text-muted-foreground hover:bg-accent',
                          index === partIndex && 'ring-1 ring-primary/40 ring-offset-1 ring-offset-background',
                        )}
                      >
                        {question.number}
                      </button>
                    </li>
                  );
                }),
              )}
            </ol>
          </div>
        </aside>

        <div className="min-w-0 space-y-6 lg:order-1">
          <nav aria-label="Parts" className="flex flex-wrap gap-2">
            {attempt.parts.map((item, index) => {
              const count = item.questions.filter((question) => answers[question.id]).length;
              const done = count === item.questions.length;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={index === partIndex ? 'step' : undefined}
                  onClick={() => showPart(index)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border-2 px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    index === partIndex
                      ? 'border-primary bg-primary text-primary-foreground'
                      : done
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  <span className="text-sm font-semibold">Part {item.number}</span>
                  <span className="text-[11px] tabular-nums opacity-80">
                    {count}/{item.questions.length}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">{part.number}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">{skillLabels[part.skill]}</p>
                <h2 className="truncate text-xl font-bold">{part.title}</h2>
              </div>
            </div>
            {part.audioUrl ? (
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <p className="mb-2 text-sm text-muted-foreground">
                  Listen, then answer the question{part.questions.length === 1 ? '' : 's'} of this part.
                </p>
                <audio controls src={part.audioUrl} className="w-full" />
              </div>
            ) : null}
            {partSections(part).map((section) => (
              <div key={section.id} className="space-y-4">
                {section.audioUrl ? (
                  <div className="rounded-2xl border bg-card p-4 shadow-sm">
                    <p className="mb-2 text-sm text-muted-foreground">
                      Listen, then answer question{section.questions.length === 1 ? '' : 's'}{' '}
                      {section.questions.map((question) => question.number).join(', ')}.
                    </p>
                    <audio controls src={section.audioUrl} className="w-full" />
                  </div>
                ) : null}
                {section.imageUrl ? <img src={section.imageUrl} alt="" className="max-h-96 rounded-lg border" /> : null}
                {section.passage ? (
                  <div className="whitespace-pre-wrap rounded-2xl border bg-card p-5 text-[15px] leading-relaxed shadow-sm sm:p-6">
                    {section.blanks ? numberBlanks(section.passage, section.questions[0].number) : <PassageText text={section.passage} />}
                  </div>
                ) : null}
                {section.questions.map((question) => (
                  <Question
                    key={question.id}
                    question={question}
                    chosen={answers[question.id]}
                    onChoose={choose}
                    blankNumber={section.blanks}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="outline" disabled={partIndex === 0} onClick={() => showPart(partIndex - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous part
            </Button>
            {partIndex < attempt.parts.length - 1 ? (
              <Button variant="outline" onClick={() => showPart(partIndex + 1)}>
                Next part
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={submitting} onClick={() => setConfirming(true)}>
                Submit
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="max-w-md rounded-2xl sm:rounded-2xl p-4">
          <AnswerProgress title="Submit your answers?" note={retakeAllowed ? '' : ' No retake after this.'} answered={answered} total={total} unanswered={unanswered} />
          <AlertDialogFooter className="flex-row flex-wrap gap-3 pt-1 sm:justify-center [&>*]:min-w-[8rem] [&>*]:flex-1">
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                submitted.current = true;
                onSubmit(answers);
              }}
            >
              <Send className="h-4 w-4" />
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent className="max-w-md rounded-2xl sm:rounded-2xl">
          <AnswerProgress
            title={`Leave the ${name}?`}
            description={`${onDiscard ? (onLeaveForLater ? 'Submit now, or leave and continue later.' : 'Submit now, or leave and lose your answers.') : 'Submit before leaving. The clock keeps running.'}${retakeAllowed ? '' : ' No retake after submitting.'}`}
            answered={answered}
            total={total}
            unanswered={unanswered}
            leaving
            closeDisabled={discarding}
          />
          <AlertDialogFooter className="flex-row flex-wrap gap-3 pt-1 sm:justify-center [&>*]:min-w-[8rem] [&>*]:flex-1">
            <AlertDialogCancel disabled={discarding}>Keep working</AlertDialogCancel>
            {leaveButtons}
            <AlertDialogAction
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={discarding}
              onClick={() => {
                submitted.current = true;
                onSubmit(answers);
              }}
            >
              <Send className="h-4 w-4" />
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={exiting} onOpenChange={(open) => !discarding && setExiting(open)}>
        <AlertDialogContent className="max-w-md rounded-2xl sm:rounded-2xl">
          <AnswerProgress
            title="Leave without submitting?"
            description={onLeaveForLater ? 'Continue later keeps your answers. Discard throws them away and the attempt does not count.' : 'Your answers are thrown away and the attempt does not count.'}
            answered={answered}
            total={total}
            unanswered={unanswered}
            leaving
            closeDisabled={discarding}
          />
          <AlertDialogFooter className="flex-row flex-wrap gap-3 pt-1 sm:justify-center [&>*]:min-w-[8rem] [&>*]:flex-1">
            <AlertDialogCancel disabled={discarding}>Keep working</AlertDialogCancel>
            {leaveButtons}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

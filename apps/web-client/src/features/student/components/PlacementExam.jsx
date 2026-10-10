import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '../../../components/ui';
import { setLeaveGuard } from '../../../lib/leave-guard.js';
import { cn } from '../../../lib/utils.js';
import { savePlacementAnswers } from '../api/placement-api.js';
import { answeredCount, formatRemaining, numberBlanks, remainingTime } from '../lib/placement.js';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };

function Question({ question, chosen, onChoose, blankNumber }) {
  return (
    <fieldset
      id={`question-${question.number}`}
      className="scroll-mt-36 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <legend className="sr-only">Question {question.number}</legend>
      <p className="font-medium">
        <span className="mr-2 text-primary">{question.number}.</span>
        {question.prompt || (blankNumber ? `Blank (${question.number})` : 'Choose the best answer.')}
      </p>
      {question.imageUrl ? (
        <img src={question.imageUrl} alt="" className="mt-3 max-h-80 rounded-lg" />
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const selected = chosen === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring',
                selected ? 'border-primary bg-primary/10' : 'hover:bg-accent',
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
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
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

// The test in progress: one part at a time, the server's clock on top.
// attempt is the IN_PROGRESS state from the API; onSubmit(answers) ends it.
export function PlacementExam({ attempt, onSubmit, submitting }) {
  const [answers, setAnswers] = useState(attempt.answers || {});
  const [partIndex, setPartIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  // { number } of the question to scroll to after showing its part.
  const [target, setTarget] = useState(null);
  // True after the learner tried to leave the page during the test.
  const [leaving, setLeaving] = useState(false);
  // Server time minus browser time at load.
  const [offset] = useState(() => new Date(attempt.serverNow).getTime() - Date.now());
  const [remaining, setRemaining] = useState(() => remainingTime(attempt.expiresAt, offset));
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submitted = useRef(false);

  // The clock; when it runs out the test is handed in as it is.
  useEffect(() => {
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

  // Answers are saved shortly after each change so they survive a reload and
  // count if the time runs out.
  useEffect(() => {
    if (answers === attempt.answers) return undefined;
    const timer = setTimeout(() => savePlacementAnswers(answers).catch(() => {}), 800);
    return () => clearTimeout(timer);
  }, [answers]);

  // A new part starts at the top of the page; a question picked from the
  // list is scrolled into view.
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
    // A new object each time, so picking the same question again scrolls again.
    setTarget({ number });
  }

  // The test cannot be left for another page: links, the back button and
  // logging out bring up a warning, and closing or reloading the tab asks
  // the browser to confirm.
  useEffect(() => {
    const removeGuard = setLeaveGuard(() => setLeaving(true));
    const onClick = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank') return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving(true);
    };
    // An extra history entry absorbs the back button.
    window.history.pushState(null, '', window.location.href);
    const onBack = () => {
      window.history.pushState(null, '', window.location.href);
      setLeaving(true);
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

  const choose = (questionId, optionId) =>
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  const part = attempt.parts[partIndex];
  const total = attempt.parts.reduce((sum, item) => sum + item.questions.length, 0);
  const answered = answeredCount(attempt.parts, answers);
  const isBlankPart = part.passage.includes('___') && part.questions.every((question) => !question.prompt);
  const lowTime = remaining <= 2 * 60 * 1000;

  return (
    <section className="space-y-6">
      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
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
        <span className="text-sm text-muted-foreground">
          {answered} of {total} answered
        </span>
        <Button className="ml-auto" disabled={submitting} onClick={() => setConfirming(true)}>
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>

      <nav aria-label="Parts" className="flex flex-wrap gap-2">
        {attempt.parts.map((item, index) => {
          const done = item.questions.every((question) => answers[question.id]);
          return (
            <button
              key={item.key}
              type="button"
              aria-current={index === partIndex ? 'step' : undefined}
              onClick={() => showPart(index)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === partIndex
                  ? 'border-primary bg-primary text-primary-foreground'
                  : done
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'text-muted-foreground hover:bg-accent',
              )}
            >
              Part {item.number}
            </button>
          );
        })}
      </nav>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Questions</p>
          <p className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-primary" /> Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-input" /> Not answered
            </span>
          </p>
        </div>
        <ol aria-label="Questions" className="flex flex-wrap gap-2">
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
                      'flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      done
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input text-muted-foreground hover:bg-accent',
                      index === partIndex && 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background',
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

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {skillLabels[part.skill]}
          </p>
          <h2 className="text-xl font-bold">
            Part {part.number}: {part.title}
          </h2>
        </div>
        {part.audioUrl ? (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-2 text-sm text-muted-foreground">
              Listen, then answer the question{part.questions.length === 1 ? '' : 's'} of this part.
            </p>
            <audio controls src={part.audioUrl} className="w-full" />
          </div>
        ) : null}
        {part.imageUrl ? <img src={part.imageUrl} alt="" className="max-h-96 rounded-lg border" /> : null}
        {part.passage ? (
          <div className="whitespace-pre-wrap rounded-xl border bg-card p-4 leading-relaxed shadow-sm sm:p-5">
            {isBlankPart ? numberBlanks(part.passage, part.questions[0].number) : part.passage}
          </div>
        ) : null}
        {part.questions.map((question) => (
          <Question
            key={question.id}
            question={question}
            chosen={answers[question.id]}
            onChoose={choose}
            blankNumber={isBlankPart}
          />
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

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit the placement test?</AlertDialogTitle>
            <AlertDialogDescription>
              {answered < total
                ? `You have answered ${answered} of ${total} questions; unanswered questions count as wrong. `
                : 'You have answered every question. '}
              You cannot change your answers or take the test again after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                submitted.current = true;
                onSubmit(answers);
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You are taking the placement test</AlertDialogTitle>
            <AlertDialogDescription>
              You cannot open another page during the test, and the clock keeps
              running. Submit the test first if you want to leave.{' '}
              {answered < total
                ? `You have answered ${answered} of ${total} questions; unanswered questions count as wrong.`
                : 'You have answered every question.'}{' '}
              You cannot take the test again after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                submitted.current = true;
                onSubmit(answers);
              }}
            >
              Submit the test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

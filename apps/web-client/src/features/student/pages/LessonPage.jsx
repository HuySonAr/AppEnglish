import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  LessonState,
  LessonStep,
  QuizKind,
  StepStatus,
} from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { getLesson, markVocabularyStudied } from '../api/lessons-api.js';
import { FillInExercise } from '../components/FillInExercise.jsx';
import { VocabularyQuiz } from '../components/VocabularyQuiz.jsx';
import { VocabularyStudy } from '../components/VocabularyStudy.jsx';

const stepLabels = {
  [LessonStep.REVIEW]: 'Review',
  [LessonStep.VOCABULARY]: 'Vocabulary',
  [LessonStep.VOCABULARY_QUIZ]: 'Word quiz',
  [LessonStep.FILL_IN]: 'Fill in',
  [LessonStep.TEST]: 'Lesson test',
};

// One lesson: review of the previous words (when required), vocabulary, word
// quiz, fill-in, then the lesson test. Steps open in order.
export function LessonPage() {
  const { lessonId } = useParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);

  // Loads the lesson; with follow=true the view moves to the current step.
  async function load({ follow = true, quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      const next = (await getLesson(lessonId)).data;
      setData(next);
      if (follow) {
        const current = next.steps.find((step) => step.status === StepStatus.CURRENT);
        setActive((current || next.steps[0]).key);
      }
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not open the lesson',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  if (state === 'loading') return <Skeleton className="h-96 w-full" />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/student/lessons">
          Back to lessons
        </Link>
      </div>
    );

  const { lesson, steps } = data;
  const statusOf = (key) => steps.find((step) => step.key === key)?.status;
  // A finished step keeps the learner on it; the next one is unlocked above.
  const stepDone = () => load({ follow: false, quiet: true });

  async function onStudied() {
    setBusy(true);
    try {
      await markVocabularyStudied(lessonId);
      await load({ quiet: true });
    } catch (error) {
      notify({ title: 'Could not save your progress', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const next = steps[steps.findIndex((step) => step.key === active) + 1];
  return (
    <section className="space-y-6">
      <Link
        to="/student/lessons"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Lessons
      </Link>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Unit {lesson.unitNumber}: {lesson.unitTitle}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Lesson {lesson.number}: {lesson.title}
          </h1>
          {lesson.state === LessonState.COMPLETED ? <Badge variant="success">Completed</Badge> : null}
        </div>
      </div>

      <ol aria-label="Lesson steps" className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const locked = step.status === StepStatus.LOCKED;
          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={locked}
                aria-current={active === step.key ? 'step' : undefined}
                onClick={() => setActive(step.key)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active === step.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : step.status === StepStatus.DONE
                      ? 'border-success/40 bg-success/10 text-success'
                      : locked
                        ? 'cursor-not-allowed text-muted-foreground opacity-60'
                        : 'hover:bg-accent',
                )}
              >
                {step.status === StepStatus.DONE ? (
                  <Check className="h-4 w-4" />
                ) : locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <span className="tabular-nums">{index + 1}</span>
                )}
                {stepLabels[step.key]}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="space-y-4">
        {active === LessonStep.REVIEW ? (
          <>
            <h2 className="text-lg font-semibold">
              Review the words of “{data.review.lessonTitle}”
            </h2>
            <VocabularyQuiz lessonId={lessonId} kind={QuizKind.REVIEW} onPassed={stepDone} />
          </>
        ) : null}
        {active === LessonStep.VOCABULARY ? (
          <>
            <h2 className="text-lg font-semibold">Vocabulary</h2>
            <VocabularyStudy
              vocabulary={data.vocabulary}
              done={statusOf(LessonStep.VOCABULARY) === StepStatus.DONE}
              busy={busy}
              onAllOpened={onStudied}
            />
          </>
        ) : null}
        {active === LessonStep.VOCABULARY_QUIZ ? (
          <>
            <h2 className="text-lg font-semibold">Word quiz</h2>
            <VocabularyQuiz lessonId={lessonId} kind={QuizKind.VOCABULARY} onPassed={stepDone} />
          </>
        ) : null}
        {active === LessonStep.FILL_IN ? (
          <>
            <h2 className="text-lg font-semibold">Fill in the blanks</h2>
            <FillInExercise lessonId={lessonId} fillIn={data.fillIn} onPassed={stepDone} />
          </>
        ) : null}
        {active === LessonStep.TEST ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Lesson test</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              23 questions in {data.test.durationMinutes} minutes. Score {data.test.passPercent}% or more
              to complete the lesson and open the next one.
              {data.test.attemptCount
                ? ` You have taken it ${data.test.attemptCount} time${data.test.attemptCount === 1 ? '' : 's'}; your best score is ${data.test.bestPercent}%.`
                : ''}
            </p>
            <Button asChild className="mt-4">
              <Link to={`/student/lessons/${lessonId}/test`}>Go to the lesson test</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {next && next.status !== StepStatus.LOCKED && active !== LessonStep.TEST ? (
        <div className="flex justify-end">
          <Button onClick={() => setActive(next.key)}>Next: {stepLabels[next.key]}</Button>
        </div>
      ) : null}
    </section>
  );
}

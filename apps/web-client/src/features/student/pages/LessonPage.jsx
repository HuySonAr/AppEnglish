import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, ListChecks, Target, Trophy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { LESSON_TEST_QUESTION_COUNT } from '@appenglish/content-contracts';
import { LessonState, LessonStep, QuizKind, StepStatus } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { StepNav, StepState } from '../../../components/shared/StepNav.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useReturnTo } from '../../../hooks/use-return-to.js';
import { getLesson, markVocabularyStudied } from '../api/lessons-api.js';
import { FillInExercise } from '../components/FillInExercise.jsx';
import { TestStartCard } from '../components/TestStartCard.jsx';
import { VocabularyQuiz } from '../components/VocabularyQuiz.jsx';
import { VocabularyStudy } from '../components/VocabularyStudy.jsx';

const stepLabels = {
  [LessonStep.REVIEW]: 'Review',
  [LessonStep.VOCABULARY]: 'Vocabulary',
  [LessonStep.VOCABULARY_QUIZ]: 'Word quiz',
  [LessonStep.FILL_IN]: 'Fill in',
  [LessonStep.TEST]: 'Lesson test',
};

const stepHints = {
  [LessonStep.REVIEW]: 'Choose the meaning of each word from the last lesson.',
  [LessonStep.VOCABULARY]: 'Learn the words of this lesson.',
  [LessonStep.VOCABULARY_QUIZ]: 'Choose the meaning of each word.',
  [LessonStep.FILL_IN]: 'Put each word in its blank.',
};

function StepCard({ title, hint, children }) {
  return (
    <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function LessonPage() {
  const { lessonId } = useParams();
  const back = useReturnTo('/student/lessons');
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);

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
      notify({ title: 'Could not open the lesson', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={back.to} state={back.state}>
          Back to lessons
        </Link>
      </div>
    );

  const { lesson, steps } = data;
  const statusOf = (key) => steps.find((step) => step.key === key)?.status;
  const stepDone = () => load({ follow: false, quiet: true });
  const doneCount = steps.filter((step) => step.status === StepStatus.DONE).length;
  const completed = lesson.state === LessonState.COMPLETED;

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
  const test = data.test;
  return (
    <section className="space-y-6">
      <PageBreadcrumb items={[{ label: 'Lessons', to: back.to, state: back.state }, { label: `Unit ${lesson.unitNumber}: ${lesson.unitTitle}` }, { label: `Lesson ${lesson.number}: ${lesson.title}` }]} />

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Unit {lesson.unitNumber} · {lesson.unitTitle}
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Lesson {lesson.number}: {lesson.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {completed ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
            </Badge>
          ) : null}
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {doneCount}/{steps.length}
            </p>
            <p className="text-xs text-muted-foreground">steps done</p>
          </div>
        </div>
      </div>

      <StepNav
        label="Lesson steps"
        active={active}
        onSelect={setActive}
        steps={steps.map((step) => ({
          key: step.key,
          label: stepLabels[step.key],
          state: step.status === StepStatus.DONE ? StepState.DONE : step.status === StepStatus.LOCKED ? StepState.LOCKED : StepState.TODO,
        }))}
      />

      {active === LessonStep.REVIEW ? (
        <StepCard title={`Review: ${data.review.lessonTitle}`} hint={stepHints[LessonStep.REVIEW]}>
          <VocabularyQuiz lessonId={lessonId} kind={QuizKind.REVIEW} onPassed={stepDone} />
        </StepCard>
      ) : null}
      {active === LessonStep.VOCABULARY ? (
        <StepCard title="Vocabulary" hint={stepHints[LessonStep.VOCABULARY]}>
          <VocabularyStudy vocabulary={data.vocabulary} done={statusOf(LessonStep.VOCABULARY) === StepStatus.DONE} busy={busy} onAllOpened={onStudied} />
        </StepCard>
      ) : null}
      {active === LessonStep.VOCABULARY_QUIZ ? (
        <StepCard title="Word quiz" hint={stepHints[LessonStep.VOCABULARY_QUIZ]}>
          <VocabularyQuiz lessonId={lessonId} kind={QuizKind.VOCABULARY} onPassed={stepDone} />
        </StepCard>
      ) : null}
      {active === LessonStep.FILL_IN ? (
        <StepCard title="Fill in the blanks" hint={stepHints[LessonStep.FILL_IN]}>
          <FillInExercise lessonId={lessonId} fillIn={data.fillIn} onPassed={stepDone} />
        </StepCard>
      ) : null}
      {active === LessonStep.TEST ? (
        <TestStartCard
          icon={Trophy}
          eyebrow={`Lesson ${lesson.number}`}
          title="Lesson test"
          badges={statusOf(LessonStep.TEST) === StepStatus.DONE ? <Badge variant="success">Passed</Badge> : null}
          stats={[
            { icon: ListChecks, label: 'Questions', value: LESSON_TEST_QUESTION_COUNT },
            { icon: Clock, label: 'Minutes', value: test.durationMinutes },
            { icon: Target, label: 'To pass', value: `${test.passPercent}%` },
            { icon: ClipboardCheck, label: 'Best', value: test.attemptCount ? `${test.bestPercent}%` : '—', tone: test.attemptCount && test.bestPercent >= test.passPercent ? 'text-success' : undefined },
          ]}
        >
          <Button asChild size="lg" className="gap-1.5">
            <Link to={`/student/lessons/${lessonId}/test`} state={back.passThrough}>
              {test.attemptCount ? 'Open the lesson test' : 'Go to the lesson test'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </TestStartCard>
      ) : null}

      {next && next.status !== StepStatus.LOCKED && active !== LessonStep.TEST ? (
        <div className="flex justify-end">
          <Button className="gap-1.5" onClick={() => setActive(next.key)}>
            Next: {stepLabels[next.key]}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

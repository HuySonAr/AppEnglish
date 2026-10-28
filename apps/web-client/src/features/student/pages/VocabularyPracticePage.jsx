import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Keyboard,
  Lightbulb,
  RotateCcw,
  Target,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import wordMemoryArt from '../../../svg/Word Memory.svg';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import {
  completeVocabularyPractice,
  getVocabularyPractice,
} from '../api/lessons-api.js';
import { Pronunciation } from '../components/VocabularyStudy.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import {
  practiceInstruction,
  practiceScore,
} from '../lib/vocabulary-practice.js';

const optionLetters = ['A', 'B', 'C', 'D'];

function WordCard({ word }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold tracking-tight text-primary">
              {word.word}
            </span>
            {word.phonetic ? (
              <span className="text-muted-foreground text-xs sm:text-sm">
                {word.phonetic}
              </span>
            ) : null}
          </div>
          <span className="ml-auto flex gap-2">
            <Pronunciation label="US" url={word.audioUsUrl} />
            <Pronunciation label="UK" url={word.audioUkUrl} />
          </span>
        </div>
        <p className="text-sm">
          <span className="font-semibold text-primary">Part of speech:</span>{' '}
          {word.partOfSpeech}
        </p>
        <p className="text-sm">
          <span className="font-semibold text-primary">Meaning:</span>{' '}
          {word.meaning}
        </p>
      </div>
      {word.example ? (
        <div className="space-y-1 rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-semibold text-primary">Example</p>
          <p>{word.example}</p>
          {word.exampleMeaning ? (
            <p className="italic text-muted-foreground">
              {word.exampleMeaning}
            </p>
          ) : null}
        </div>
      ) : null}
      {word.lessonTitle ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">From your lesson:</span>{' '}
            {word.lessonTitle}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RoundPanel({ questions, answers, index, score }) {
  const left = questions.length - score.answered;
  const stats = [
    { label: 'Right', value: score.correct, tone: 'text-success' },
    { label: 'Wrong', value: score.wrong.length, tone: 'text-destructive' },
    { label: 'Left', value: left, tone: 'text-primary' },
  ];
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Brain className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">Think first, then pick</p>
          <p className="text-sm text-muted-foreground">
            The word, its sound and an example open here.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-muted/40 px-3 py-2 text-center"
          >
            <p className={cn('text-lg font-semibold tabular-nums', stat.tone)}>
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <ol className="flex flex-wrap gap-1.5" aria-label="Questions">
        {questions.map((item, at) => {
          const value = answers[item.id];
          return (
            <li
              key={item.id}
              aria-label={`Question ${at + 1}`}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                value === undefined
                  ? at === index
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  : value === item.answer
                    ? 'bg-success/15 text-success'
                    : 'bg-destructive/15 text-destructive',
              )}
            >
              {at + 1}
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Keyboard className="h-3.5 w-3.5" />
        Press A–D or 1–4 to answer, Enter for the next word.
      </p>
    </div>
  );
}

function Header({ back, aside }) {
  return (
    <div className="space-y-2">
      {back}
      <div className="flex flex-wrap items-center gap-2.5">
        <img src={wordMemoryArt} alt="" aria-hidden="true" draggable="false" className="h-11 w-11 shrink-0 select-none rounded-lg border" />
        <div className="min-w-0 flex-1">
          <h1 className="sm:text-xl font-bold tracking-tight">Word memory</h1>
          <p className="hidden sm:block text-sm text-muted-foreground">
            Choose the right answer to see the word, its sound and an example.
          </p>
        </div>
        {aside}
      </div>
    </div>
  );
}

export function VocabularyPracticePage() {
  const [state, setState] = useState('loading');
  const [practice, setPractice] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const nextButton = useRef(null);

  async function load() {
    setState('loading');
    try {
      setPractice((await getVocabularyPractice()).data);
      setAnswers({});
      setIndex(0);
      setState('ready');
      window.scrollTo({ top: 0 });
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the practice',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const questions = practice?.questions || [];
  const question = questions[index];
  const chosen = question ? answers[question.id] : undefined;
  const answered = chosen !== undefined;

  function choose(option) {
    if (!question || answered) return;
    setAnswers((current) => ({ ...current, [question.id]: option }));
  }

  useEffect(() => {
    if (answered) nextButton.current?.focus();
  }, [answered, index]);

  const roundOver =
    Boolean(practice?.available) &&
    questions.length > 0 &&
    index >= questions.length;
  useEffect(() => {
    if (roundOver) completeVocabularyPractice().catch(() => {});
  }, [roundOver, practice]);

  useEffect(() => {
    if (state !== 'ready' || !question) return undefined;
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea')) return;
      if (
        answered &&
        event.key === 'Enter' &&
        !event.target.closest?.('button')
      ) {
        event.preventDefault();
        setIndex((value) => value + 1);
        return;
      }
      const key = event.key.toUpperCase();
      const at = ['1', '2', '3', '4'].includes(key)
        ? Number(key) - 1
        : optionLetters.indexOf(key);
      if (!answered && at >= 0 && question.options[at]) {
        event.preventDefault();
        choose(question.options[at]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const back = (
    <PageBreadcrumb
      items={[
        { label: 'Practice', to: '/student/practice' },
        { label: 'Word memory' },
      ]}
    />
  );

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  if (!practice.available)
    return (
      <section className="mx-auto max-w-2xl space-y-6">
        <Header back={back} />
        <div className="space-y-4 rounded-xl border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Not open yet</p>
          <p className="text-sm text-muted-foreground">
            It opens at {practice.size} words from your completed lessons.
          </p>
          <div className="mx-auto max-w-sm space-y-1.5">
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (practice.wordCount * 100) / practice.size)}%`,
                }}
              />
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {practice.wordCount} of {practice.size} words ·{' '}
              {practice.completedLessonCount} lesson
              {practice.completedLessonCount === 1 ? '' : 's'} completed
            </p>
          </div>
          <Button asChild>
            <Link to="/student/lessons">Go to lessons</Link>
          </Button>
        </div>
      </section>
    );

  const score = practiceScore(questions, answers);
  const finished =
    score.answered === questions.length && index >= questions.length;

  if (finished) {
    const percent = questions.length
      ? Math.round((score.correct * 100) / questions.length)
      : 0;
    return (
      <section className="mx-auto max-w-4xl space-y-6">
        <Header back={back} />
        <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-6 sm:flex-row sm:p-8">
          <ScoreRing
            percent={percent}
            tone={score.wrong.length ? 'primary' : 'success'}
            label={`${score.correct}/${questions.length}`}
          />
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-success/5 p-3">
                <p className="text-xs text-muted-foreground">Right</p>
                <p className="text-2xl font-bold tabular-nums text-success">
                  {score.correct}
                </p>
              </div>
              <div className="rounded-xl border bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">To review</p>
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  {score.wrong.length}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
              <Button className="gap-1.5" onClick={load}>
                <RotateCcw className="h-4 w-4" />
                Practise again
              </Button>
              <Button asChild variant="outline">
                <Link to="/student/practice">Back to practice</Link>
              </Button>
            </div>
          </div>
        </div>
        {score.wrong.length ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Words to review</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {score.wrong.map((item) => (
                <li key={item.id}>
                  <WordCard word={item.word} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  const last = index === questions.length - 1;
  const percent = questions.length
    ? Math.round((score.answered * 100) / questions.length)
    : 0;

  return (
    <section className="mx-auto max-w-6xl space-y-3">
      <Header
        back={back}
        aside={
          <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
            <Target className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <p className="font-semibold">From your lessons</p>
              <p className="text-muted-foreground">
                {questions.length} questions ·{' '}
                <span className="font-medium text-success">
                  {score.correct}
                </span>{' '}
                right
              </p>
            </div>
          </div>
        }
      />

      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2 text-sm">
        <p className="shrink-0 font-medium tabular-nums">
          Question {index + 1} / {questions.length}
        </p>
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="shrink-0 font-medium tabular-nums text-primary">
          {percent}%
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <fieldset className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <legend className="sr-only">Question {index + 1}</legend>
          <div className="flex flex-wrap items-center gap-2 !mt-0">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Question {index + 1}
            </span>
            <span className="text-sm text-muted-foreground">
              {practiceInstruction(question)}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-lg font-semibold">{question.prompt}</p>
            <Badge variant="secondary">{question.partOfSpeech}</Badge>
          </div>
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => {
              const isRight = option === question.answer;
              const picked = option === chosen;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={answered}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    !answered && 'hover:border-primary/40 hover:bg-accent',
                    answered && isRight && 'border-success/50 bg-success/10',
                    answered &&
                      picked &&
                      !isRight &&
                      'border-destructive/50 bg-destructive/10',
                    answered && !isRight && !picked && 'opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold',
                      answered && isRight && 'bg-success text-white',
                      answered &&
                        picked &&
                        !isRight &&
                        'bg-destructive text-white',
                    )}
                  >
                    {optionLetters[optionIndex]}
                  </span>
                  <span className="flex-1 font-medium">{option}</span>
                  {answered && isRight ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : null}
                  {answered && picked && !isRight ? (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div aria-live="polite">
          {answered ? (
            <WordCard word={question.word} />
          ) : (
            <RoundPanel
              questions={questions}
              answers={answers}
              index={index}
              score={score}
            />
          )}
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card p-2">
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          ref={nextButton}
          className="gap-1.5"
          disabled={!answered}
          onClick={() => setIndex(index + 1)}
        >
          {last ? 'See the results' : 'Next word'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

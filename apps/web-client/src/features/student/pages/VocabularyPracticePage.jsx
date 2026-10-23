import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Brain, Check, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { completeVocabularyPractice, getVocabularyPractice } from '../api/lessons-api.js';
import { Pronunciation } from '../components/VocabularyStudy.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { practiceInstruction, practiceScore } from '../lib/vocabulary-practice.js';

const optionLetters = ['A', 'B', 'C', 'D'];

function WordDetails({ word, tone }) {
  return (
    <div className={cn('space-y-3 rounded-2xl border bg-card p-5 shadow-sm', tone)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xl font-bold">{word.word}</span>
        <Badge variant="secondary">{word.partOfSpeech}</Badge>
        {word.phonetic ? <span className="text-sm text-muted-foreground">{word.phonetic}</span> : null}
        <span className="ml-auto flex gap-2">
          <Pronunciation label="UK" url={word.audioUkUrl} />
          <Pronunciation label="US" url={word.audioUsUrl} />
        </span>
      </div>
      <p className="text-lg font-medium">{word.meaning}</p>
      {word.example ? (
        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          <p>{word.example}</p>
          {word.exampleMeaning ? <p className="mt-1 text-muted-foreground">{word.exampleMeaning}</p> : null}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">From “{word.lessonTitle}”</p>
    </div>
  );
}

function Header({ back, children }) {
  return (
    <div className="space-y-4">
      {back}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Brain className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Practice</p>
          <h1 className="text-2xl font-bold">Word memory</h1>
        </div>
        {children}
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
      notify({ title: 'Could not load the practice', description: getApiErrorMessage(error), variant: 'destructive' });
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

  const roundOver = Boolean(practice?.available) && questions.length > 0 && index >= questions.length;
  useEffect(() => {
    if (roundOver) completeVocabularyPractice().catch(() => {});
  }, [roundOver, practice]);

  useEffect(() => {
    if (state !== 'ready' || !question) return undefined;
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea')) return;
      if (answered && event.key === 'Enter' && !event.target.closest?.('button')) {
        event.preventDefault();
        setIndex((value) => value + 1);
        return;
      }
      const key = event.key.toUpperCase();
      const at = ['1', '2', '3', '4'].includes(key) ? Number(key) - 1 : optionLetters.indexOf(key);
      if (!answered && at >= 0 && question.options[at]) {
        event.preventDefault();
        choose(question.options[at]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const back = (
    <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Word memory' }]} />
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
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">Not open yet</p>
          <p className="text-sm text-muted-foreground">
            It opens at {practice.size} words from your completed lessons.
          </p>
          <div className="mx-auto max-w-sm space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (practice.wordCount * 100) / practice.size)}%` }} />
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {practice.wordCount} of {practice.size} words · {practice.completedLessonCount} lesson{practice.completedLessonCount === 1 ? '' : 's'} completed
            </p>
          </div>
          <Button asChild>
            <Link to="/student/lessons">Go to lessons</Link>
          </Button>
        </div>
      </section>
    );

  const score = practiceScore(questions, answers);
  const finished = score.answered === questions.length && index >= questions.length;

  if (finished) {
    const percent = questions.length ? Math.round((score.correct * 100) / questions.length) : 0;
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <Header back={back} />
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:p-8">
          <ScoreRing percent={percent} tone={score.wrong.length ? 'primary' : 'success'} label={`${score.correct}/${questions.length}`} />
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-success/5 p-3">
                <p className="text-xs text-muted-foreground">Right</p>
                <p className="text-2xl font-bold tabular-nums text-success">{score.correct}</p>
              </div>
              <div className="rounded-xl border bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">To review</p>
                <p className="text-2xl font-bold tabular-nums text-destructive">{score.wrong.length}</p>
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
                  <WordDetails word={item.word} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  const right = chosen === question.answer;
  const last = index === questions.length - 1;

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <Header back={back}>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">
            <span className="text-success">{score.correct}</span>
            <span className="text-base font-normal text-muted-foreground">/{score.answered}</span>
          </p>
          <p className="text-xs text-muted-foreground">right so far</p>
        </div>
      </Header>

      <ol className="flex flex-wrap justify-center gap-1.5" aria-label="Questions">
        {questions.map((item, at) => {
          const value = answers[item.id];
          return (
            <li
              key={item.id}
              aria-label={`Question ${at + 1}`}
              className={cn(
                'h-2.5 rounded-full transition-all',
                at === index ? 'w-7' : 'w-2.5',
                value === undefined ? (at === index ? 'bg-primary' : 'bg-muted-foreground/25') : value === item.answer ? 'bg-success' : 'bg-destructive',
              )}
            />
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <fieldset className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <legend className="sr-only">Question {index + 1}</legend>
          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {index + 1} of {questions.length} · {practiceInstruction(question)}
            </p>
            <p className="text-3xl font-bold">{question.prompt}</p>
            <Badge variant="secondary">{question.partOfSpeech}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
                    'flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    !answered && 'border-border hover:border-primary/40 hover:bg-accent',
                    answered && isRight && 'border-success bg-success/10',
                    answered && picked && !isRight && 'border-destructive bg-destructive/10',
                    answered && !isRight && !picked && 'border-border opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold text-muted-foreground',
                      answered && isRight && 'border-success bg-success text-white',
                      answered && picked && !isRight && 'border-destructive bg-destructive text-white',
                    )}
                  >
                    {answered && isRight ? <Check className="h-4 w-4" /> : answered && picked ? <X className="h-4 w-4" /> : optionLetters[optionIndex]}
                  </span>
                  <span className="font-medium">{option}</span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">{answered ? "Enter: next word" : "Press A–D or 1–4 to answer."}</p>
        </fieldset>

        <div className="space-y-4 lg:sticky lg:top-20" aria-live="polite">
          {answered ? (
            <>
              <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-4', right ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10')}>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white', right ? 'bg-success' : 'bg-destructive')}>
                  {right ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                </span>
                <p className="flex-1 font-semibold">{right ? 'Right!' : `The answer is “${question.answer}”.`}</p>
                <Button ref={nextButton} className="hidden gap-1.5 lg:inline-flex" onClick={() => setIndex(index + 1)}>
                  {last ? 'See the results' : 'Next word'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <WordDetails word={question.word} />
            </>
          ) : (
            <div className="hidden h-full min-h-[16rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground lg:flex">
              <Brain className="h-8 w-8 opacity-40" />
              <p>Choose an answer to see the word here.</p>
            </div>
          )}
        </div>
      </div>

      {answered ? (
        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
          <Button className="w-full gap-1.5" size="lg" onClick={() => setIndex(index + 1)}>
            {last ? 'See the results' : 'Next word'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

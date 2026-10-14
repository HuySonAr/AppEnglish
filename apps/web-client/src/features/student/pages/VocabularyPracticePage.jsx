import { useEffect, useState } from 'react';
import { ArrowLeft, Brain, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { getVocabularyPractice } from '../api/lessons-api.js';
import { Pronunciation } from '../components/VocabularyStudy.jsx';
import { practiceInstruction, practiceScore } from '../lib/vocabulary-practice.js';

const optionLetters = ['A', 'B', 'C', 'D'];

// The word behind a question, shown once it is answered.
function WordDetails({ word }) {
  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">{word.word}</span>
        <Badge variant="secondary">{word.partOfSpeech}</Badge>
        {word.phonetic ? <span className="text-muted-foreground">{word.phonetic}</span> : null}
      </div>
      <p className="font-medium">{word.meaning}</p>
      <p>{word.example}</p>
      {word.exampleMeaning ? <p className="text-muted-foreground">{word.exampleMeaning}</p> : null}
      <Pronunciation label="UK" url={word.audioUkUrl} />
      <Pronunciation label="US" url={word.audioUsUrl} />
      <p className="text-xs text-muted-foreground">From the lesson “{word.lessonTitle}”</p>
    </div>
  );
}

// Word memory (F05B-1, D84): 20 words of the completed lessons, one at a time,
// each checked as soon as it is answered, then the score and the words to
// look at again.
export function VocabularyPracticePage() {
  const [state, setState] = useState('loading');
  const [practice, setPractice] = useState(null);
  // Question id → the option chosen.
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);

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

  const back = (
    <Link to="/student/practice" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Practice
    </Link>
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
      <section className="space-y-6">
        {back}
        <EmptyState
          icon={Brain}
          title="Word memory is not open yet"
          description={`It opens when the lessons you completed hold ${practice.size} different words. You have ${practice.wordCount} of ${practice.size} from ${practice.completedLessonCount} completed lesson${practice.completedLessonCount === 1 ? '' : 's'}.`}
          action={
            <Button asChild>
              <Link to="/student/lessons">Go to lessons</Link>
            </Button>
          }
        />
      </section>
    );

  const { questions } = practice;
  const score = practiceScore(questions, answers);
  const finished = score.answered === questions.length && index >= questions.length;

  if (finished)
    return (
      <section className="space-y-6">
        {back}
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Word memory</p>
          <p className={cn('mt-3 text-6xl font-bold tracking-tight', score.wrong.length ? 'text-foreground' : 'text-success')}>
            {score.correct}/{questions.length}
          </p>
          <p className="mt-2 text-muted-foreground">
            {score.wrong.length ? `${score.wrong.length} word${score.wrong.length === 1 ? '' : 's'} to look at again.` : 'Every word right.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link to="/student/practice">Back to practice</Link>
            </Button>
            <Button onClick={load}>Practise again</Button>
          </div>
        </div>
        {score.wrong.length ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Words to look at again</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {score.wrong.map((question) => (
                <li key={question.id}>
                  <WordDetails word={question.word} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );

  const question = questions[index];
  const chosen = answers[question.id];
  const answered = chosen !== undefined;
  const last = index === questions.length - 1;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      {back}
      <PageHeader eyebrow="Practice" title="Word memory" />
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground tabular-nums">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>
            <span className="font-semibold text-success">{score.correct}</span> right · {score.answered - score.correct} wrong
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(score.answered * 100) / questions.length}%` }} />
        </div>
      </div>

      <fieldset className="rounded-xl border bg-card p-5 shadow-sm">
        <legend className="sr-only">Question {index + 1}</legend>
        <p className="text-sm text-muted-foreground">{practiceInstruction(question)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {question.prompt}
          <Badge variant="secondary">{question.partOfSpeech}</Badge>
        </p>
        <div className="mt-4 grid gap-2">
          {question.options.map((option, optionIndex) => {
            const right = option === question.answer;
            const picked = option === chosen;
            return (
              <button
                key={option}
                type="button"
                disabled={answered}
                onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !answered && 'hover:bg-accent',
                  answered && right && 'border-success/50 bg-success/10',
                  answered && picked && !right && 'border-destructive/50 bg-destructive/10',
                  answered && !right && !picked && 'opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground',
                    answered && right && 'border-success bg-success text-white',
                    answered && picked && !right && 'border-destructive bg-destructive text-white',
                  )}
                >
                  {answered && right ? <Check className="h-4 w-4" /> : answered && picked ? <X className="h-4 w-4" /> : optionLetters[optionIndex]}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {answered ? (
        <div className="space-y-4" aria-live="polite">
          <p className={cn('font-semibold', chosen === question.answer ? 'text-success' : 'text-destructive')}>
            {chosen === question.answer ? 'Right!' : `Not right. The answer is “${question.answer}”.`}
          </p>
          <WordDetails word={question.word} />
          <Button onClick={() => setIndex(index + 1)}>{last ? 'See the results' : 'Next word'}</Button>
        </div>
      ) : null}
    </section>
  );
}

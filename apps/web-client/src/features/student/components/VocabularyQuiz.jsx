import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { getVocabularyQuiz, submitVocabularyQuiz } from '../api/lessons-api.js';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];

// Choose the meaning of every word (kind is QuizKind: this lesson's words or
// the review of the previous lesson). Every word must be right; the wrong ones
// are marked and the learner tries again. onPassed is called once all are right.
export function VocabularyQuiz({ lessonId, kind, onPassed }) {
  const [state, setState] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [wrongIds, setWrongIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [passed, setPassed] = useState(false);

  async function load() {
    setState('loading');
    try {
      setQuestions((await getVocabularyQuiz(lessonId, kind)).data.questions);
      setAnswers({});
      setWrongIds([]);
      setPassed(false);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the quiz', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [lessonId, kind]);

  async function check() {
    setBusy(true);
    try {
      const result = (await submitVocabularyQuiz(lessonId, kind, answers)).data;
      setWrongIds(result.wrongIds);
      if (result.passed) {
        setPassed(true);
        notify({ title: 'All correct' });
        onPassed();
      } else {
        notify({
          title: `${result.wrongIds.length} of ${result.total} to fix`,
          description: 'Change the marked answers and check again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      notify({ title: 'Could not check the answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <RowsSkeleton rows={3} tall />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const answered = questions.filter((question) => answers[question.id]).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the meaning of each word. All {questions.length} must be right; you can try as often as you need.
      </p>
      <ol className="space-y-3">
        {questions.map((question, index) => {
          const wrong = wrongIds.includes(question.id);
          return (
            <li key={question.id}>
              <fieldset className={cn('rounded-xl border bg-card p-4 shadow-sm', wrong && 'border-destructive/60')}>
                <legend className="sr-only">Word {index + 1}</legend>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="text-primary">{index + 1}.</span>
                  {question.word}
                  <Badge variant="secondary">{question.partOfSpeech}</Badge>
                  {wrong ? <Badge variant="destructive">Not right</Badge> : null}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = answers[question.id] === option;
                    return (
                      <label
                        key={option}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring',
                          selected ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                        )}
                      >
                        <input
                          type="radio"
                          name={`quiz-${kind}-${question.id}`}
                          className="sr-only"
                          checked={selected}
                          disabled={passed}
                          onChange={() => {
                            setAnswers((current) => ({ ...current, [question.id]: option }));
                            setWrongIds((current) => current.filter((id) => id !== question.id));
                          }}
                        />
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                            selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {optionLetters[optionIndex]}
                        </span>
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={busy || passed || answered < questions.length} onClick={check}>
          {busy ? 'Checking…' : 'Check answers'}
        </Button>
        <span className="text-sm text-muted-foreground">
          {answered} of {questions.length} answered
        </span>
        {passed ? (
          <Button variant="outline" onClick={load}>
            Practise again with a new order
          </Button>
        ) : null}
      </div>
    </div>
  );
}

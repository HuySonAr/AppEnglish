import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { getVocabularyQuiz, submitVocabularyQuiz } from '../api/lessons-api.js';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { QuizLight, checkedLights, lightOf, withAnswerChanged } from '../lib/quiz-lights.js';

const optionLetters = ['A', 'B', 'C', 'D'];
const lightStyles = {
  [QuizLight.UNCHECKED]: { tone: 'bg-muted text-muted-foreground', label: 'not checked' },
  [QuizLight.RIGHT]: { tone: 'bg-success/15 text-success', label: 'right' },
  [QuizLight.WRONG]: { tone: 'bg-destructive/10 text-destructive', label: 'not right' },
};

// The light of one word: grey until checked, then green or red (D83).
function WordLight({ light, className }) {
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', lightStyles[light].tone, className)}>
      <Lightbulb className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

// Choose the meaning of every word (kind is QuizKind: this lesson's words or
// the review of the previous lesson). Every word must be right; the wrong ones
// are marked and the learner tries again. onPassed is called once all are right.
export function VocabularyQuiz({ lessonId, kind, onPassed }) {
  const [state, setState] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  // Question id → QuizLight of the words checked and not changed since.
  const [lights, setLights] = useState({});
  const [busy, setBusy] = useState(false);
  const [passed, setPassed] = useState(false);

  async function load() {
    setState('loading');
    try {
      setQuestions((await getVocabularyQuiz(lessonId, kind)).data.questions);
      setAnswers({});
      setLights({});
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
      setLights(checkedLights(questions, result.wrongIds));
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
  const wordId = (index) => `quiz-${kind}-word-${index + 1}`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the meaning of each word. All {questions.length} must be right; you can try as often as you need.
      </p>
      {/* One light per word: grey until checked, then green or red. */}
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <ol aria-label="Results" className="flex flex-wrap gap-2">
          {questions.map((question, index) => {
            const light = lightOf(lights, question.id);
            return (
              <li key={question.id}>
                <button
                  type="button"
                  aria-label={`Word ${index + 1}: ${lightStyles[light].label}`}
                  title={`${question.word}: ${lightStyles[light].label}`}
                  className="flex flex-col items-center gap-0.5 rounded-lg p-1 text-xs font-medium text-muted-foreground tabular-nums hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => document.getElementById(wordId(index))?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                >
                  <WordLight light={light} />
                  {index + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="space-y-3">
        {questions.map((question, index) => {
          const light = lightOf(lights, question.id);
          const wrong = light === QuizLight.WRONG;
          return (
            <li key={question.id} id={wordId(index)} className="scroll-mt-24">
              <fieldset
                className={cn(
                  'rounded-xl border bg-card p-4 shadow-sm',
                  wrong && 'border-destructive/60',
                  light === QuizLight.RIGHT && 'border-success/40',
                )}
              >
                <legend className="sr-only">Word {index + 1}</legend>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <WordLight light={light} />
                  <span className="sr-only">{lightStyles[light].label}</span>
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
                            setLights((current) => withAnswerChanged(current, question.id));
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

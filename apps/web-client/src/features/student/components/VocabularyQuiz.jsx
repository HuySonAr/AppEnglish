import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Card, CardContent } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { getVocabularyQuiz, submitVocabularyQuiz } from '../api/lessons-api.js';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { QuizLight, checkedLights, lightOf, withAnswerChanged } from '../lib/quiz-lights.js';

const optionLetters = ['A', 'B', 'C', 'D'];

export function VocabularyQuiz({ lessonId, kind, onPassed }) {
  const [state, setState] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [lights, setLights] = useState({});
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [passed, setPassed] = useState(false);
  const advance = useRef(null);

  async function load() {
    setState('loading');
    try {
      setQuestions((await getVocabularyQuiz(lessonId, kind)).data.questions);
      setAnswers({});
      setLights({});
      setAt(0);
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

  useEffect(() => () => clearTimeout(advance.current), []);

  function choose(question, option) {
    const next = { ...answers, [question.id]: option };
    setAnswers(next);
    setLights((current) => withAnswerChanged(current, question.id));
    clearTimeout(advance.current);
    const following = questions.findIndex((item, index) => index > at && !next[item.id]);
    const anyLeft = following >= 0 ? following : questions.findIndex((item) => !next[item.id]);
    if (anyLeft >= 0) advance.current = setTimeout(() => setAt(anyLeft), 350);
  }

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
        notify({ title: `${result.wrongIds.length} of ${result.total} to fix`, description: 'Change the red words and check again.', variant: 'destructive' });
        const firstWrong = questions.findIndex((question) => result.wrongIds.includes(question.id));
        if (firstWrong >= 0) setAt(firstWrong);
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
  if (!questions.length) return <p className="text-sm text-muted-foreground">This quiz has no words.</p>;

  const question = questions[at];
  const answered = questions.filter((item) => answers[item.id]).length;
  const light = lightOf(lights, question.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Words">
        {questions.map((item, index) => {
          const itemLight = lightOf(lights, item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Word ${index + 1}`}
              aria-current={index === at ? 'step' : undefined}
              onClick={() => setAt(index)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                itemLight === QuizLight.RIGHT
                  ? 'border-success bg-success text-white'
                  : itemLight === QuizLight.WRONG
                    ? 'border-destructive bg-destructive text-white'
                    : answers[item.id]
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'text-muted-foreground',
                index === at && 'ring-2 ring-primary ring-offset-2',
              )}
            >
              {itemLight === QuizLight.RIGHT ? <Check className="h-3.5 w-3.5" /> : itemLight === QuizLight.WRONG ? <X className="h-3.5 w-3.5" /> : index + 1}
            </button>
          );
        })}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {answered} of {questions.length} answered
        </span>
      </div>

      <Card className={cn('border-2 transition-colors', light === QuizLight.WRONG ? 'border-destructive/50' : light === QuizLight.RIGHT ? 'border-success/50' : 'border-transparent')}>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Word {at + 1} of {questions.length}
            </p>
            <p className="text-3xl font-bold">{question.word}</p>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary">{question.partOfSpeech}</Badge>
              {light === QuizLight.WRONG ? <Badge variant="destructive">Not right</Badge> : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={`Meaning of ${question.word}`}>
            {question.options.map((option, index) => {
              const selected = answers[question.id] === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={passed}
                  onClick={() => choose(question, option)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-accent',
                  )}
                >
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                    {optionLetters[index]}
                  </span>
                  <span className="font-medium">{option}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="outline" size="sm" className="gap-1" disabled={at === 0} onClick={() => setAt(at - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" className="gap-1" disabled={at === questions.length - 1} onClick={() => setAt(at + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-auto flex gap-2">
              {passed ? (
                <Button variant="outline" className="gap-1.5" onClick={load}>
                  <RotateCcw className="h-4 w-4" />
                  Practise again
                </Button>
              ) : (
                <Button loading={busy} disabled={busy || answered < questions.length} onClick={check}>
                  {busy ? 'Checking…' : 'Check answers'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { CheckCircle2, Circle, ListChecks, Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { isScoring } from '../lib/practice.js';
import { SetResults } from './EtsSpeaking.jsx';
import { ResultCard } from './PracticeTabs.jsx';
import { SpeakingResult } from './SpeakingResult.jsx';
import { TeacherReviewPanel } from './TeacherReviewPanel.jsx';

function stepState(index, current) {
  if (index < current) return 'done';
  return index === current ? 'active' : 'waiting';
}

export function ScoringWait({ answers, hasKey, expected = 1 }) {
  const grading = answers.some((answer) => answer.stage === 'grading');
  const sent = answers.length >= expected;
  const steps = ['Sending your recording', 'Listening to your recording', ...(hasKey ? ['Gemini is writing feedback'] : [])];
  const current = !sent ? 0 : grading ? 2 : 1;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-xl border bg-card px-6 py-10 text-center" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">Scoring your answer</p>
        <p className="text-sm text-muted-foreground">Your result opens here in a moment.</p>
      </div>
      <ol className="w-full space-y-2 text-left text-sm">
        {steps.map((step, index) => {
          const state = stepState(index, current);
          return (
            <li key={step} className={cn('flex items-center gap-2', state === 'waiting' && 'text-muted-foreground')}>
              {state === 'done' ? <CheckCircle2 className="h-4 w-4 text-success" /> : state === 'active' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Circle className="h-4 w-4" />}
              {step}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SpeakingResultScreen({ answers, setTask, questions, hasKey, quota, onReview, onAgain, listPath }) {
  const expected = setTask ? questions.length : 1;
  const waiting = !answers.length || answers.length < expected || answers.some(isScoring);
  const byQuestion = (a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0);
  const single = answers[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{waiting ? 'Scoring' : 'Your result'}</p>
        {waiting ? null : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to={listPath}>
                <ListChecks className="h-4 w-4" />
                Other prompts
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onAgain}>
              <RotateCcw className="h-4 w-4" />
              Practice again
            </Button>
          </div>
        )}
      </div>
      {waiting ? (
        <ScoringWait answers={answers} hasKey={hasKey} expected={expected} />
      ) : setTask ? (
        <SetResults hasKey={hasKey} answers={[...answers].sort(byQuestion)} questions={questions} quota={quota} onReview={onReview} />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <ResultCard submission={single} title="Result">
            <SpeakingResult submission={single} hasKey={hasKey} />
          </ResultCard>
          <TeacherReviewPanel submission={single} quota={quota} onRequested={(answer) => onReview(single, answer)} />
        </div>
      )}
    </div>
  );
}

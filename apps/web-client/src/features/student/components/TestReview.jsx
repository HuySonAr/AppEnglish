import { Check, X } from 'lucide-react';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { Badge } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { numberBlanks, partSections } from '../lib/placement.js';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { LISTENING: 'Listening', READING: 'Reading' };

function Transcript({ text }) {
  return (
    <details className="rounded-xl border bg-card p-4 text-sm shadow-sm">
      <summary className="cursor-pointer font-medium">Transcript</summary>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">{text}</p>
    </details>
  );
}

function ReviewedQuestion({ question, blank }) {
  const correct = question.options.find((option) => option.isCorrect);
  const right = question.chosenOptionId === correct?.id;
  return (
    <div
      className={cn('rounded-xl border bg-card p-4 shadow-sm', right ? 'border-success/40' : 'border-destructive/40')}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">
          <span className="mr-2 text-primary">{question.number}.</span>
          {question.prompt || (blank ? `Blank (${question.number})` : 'Choose the best answer.')}
        </p>
        <Badge variant={right ? 'success' : 'destructive'}>
          {right ? 'Correct' : question.chosenOptionId ? 'Wrong' : 'Not answered'}
        </Badge>
      </div>
      {question.audioUrl ? <audio controls src={question.audioUrl} className="mt-3 w-full" /> : null}
      {question.transcript ? (
        <div className="mt-3">
          <Transcript text={question.transcript} />
        </div>
      ) : null}
      {question.imageUrl ? <img src={question.imageUrl} alt="" className="mt-3 max-h-80 rounded-lg" /> : null}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const chosen = option.id === question.chosenOptionId;
          return (
            <li
              key={option.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                option.isCorrect
                  ? 'border-success/50 bg-success/10'
                  : chosen
                    ? 'border-destructive/50 bg-destructive/10'
                    : 'text-muted-foreground',
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                {optionLetters[index]}
              </span>
              <span className="flex-1">{option.text}</span>
              {option.isCorrect ? <Check className="h-4 w-4 text-success" aria-label="Correct answer" /> : null}
              {chosen && !option.isCorrect ? <X className="h-4 w-4 text-destructive" aria-label="Your answer" /> : null}
              {chosen ? <span className="text-xs text-muted-foreground">Your answer</span> : null}
            </li>
          );
        })}
      </ul>
      {question.explanation ? (
        <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
          <span className="font-medium">Explanation: </span>
          {question.explanation}
        </p>
      ) : null}
    </div>
  );
}

export function TestReview({ parts }) {
  return (
    <div className="space-y-8">
      {parts.map((part) => {
        return (
          <div key={part.key} className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {skillLabels[part.skill]}
              </p>
              <h3 className="text-lg font-bold">
                Part {part.number}: {part.title}
              </h3>
            </div>
            {part.audioUrl ? <audio controls src={part.audioUrl} className="w-full" /> : null}
            {part.transcript ? <Transcript text={part.transcript} /> : null}
            {partSections(part).map((section) => (
              <div key={section.id} className="space-y-3">
                {section.audioUrl ? <audio controls src={section.audioUrl} className="w-full" /> : null}
                {section.transcript ? <Transcript text={section.transcript} /> : null}
                {section.imageUrl ? <img src={section.imageUrl} alt="" className="max-h-96 rounded-lg border" /> : null}
                {section.passage ? (
                  <div className="whitespace-pre-wrap rounded-xl border bg-card p-4 leading-relaxed shadow-sm">
                    {section.blanks ? numberBlanks(section.passage, section.questions[0].number) : <PassageText text={section.passage} />}
                  </div>
                ) : null}
                {section.questions.map((question) => (
                  <ReviewedQuestion key={question.id} question={question} blank={section.blanks} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

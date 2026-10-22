import { Check, X } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { Badge } from '../../../components/ui';

// One multiple-choice question of the Listening course (D143): before it is
// checked the learner picks an option; once checked (`marked`), the right
// option shows in green, a wrong choice in red, with the explanation.
export function CourseQuestion({ number, question, chosen, marked, onChoose }) {
  const picked = marked ? marked.chosenOptionId : chosen;
  return (
    <fieldset className="space-y-3">
      <legend className="flex flex-wrap items-center gap-2 font-medium">
        <span>
          {number ? `${number}. ` : ''}
          {question.prompt}
        </span>
        {question.skill === 'inference' ? <Badge variant="outline">What is meant</Badge> : null}
      </legend>
      <div className="grid gap-2">
        {question.options.map((option, index) => {
          const selected = picked === option.id;
          const right = marked && option.id === marked.correctOptionId;
          const wrong = marked && selected && !right;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={Boolean(marked)}
              onClick={() => onChoose(option.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default',
                !marked && 'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && !marked && 'border-primary bg-primary/5',
                right && 'border-success bg-success/10',
                wrong && 'border-destructive bg-destructive/10',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  selected && !marked && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1">{option.text}</span>
              {right ? <Check className="h-4 w-4 text-success" aria-label="Right answer" /> : null}
              {wrong ? <X className="h-4 w-4 text-destructive" aria-label="Your answer" /> : null}
            </button>
          );
        })}
      </div>
      {marked ? (
        <p className="text-sm">
          <span className={cn('font-semibold', marked.correct ? 'text-success' : 'text-destructive')}>
            {marked.correct ? 'Right.' : marked.chosenOptionId ? 'Not quite.' : 'Not answered.'}
          </span>{' '}
          {marked.explanation ? <span className="text-muted-foreground">{marked.explanation}</span> : null}
        </p>
      ) : null}
    </fieldset>
  );
}

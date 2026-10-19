import { Check, X } from 'lucide-react';
import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { courseBlankKey } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';
import { Badge, Input } from '../../../components/ui';

// The blanks of a sentence or passage (D109): inputs while open, then each
// blank green or red with what was typed and, when wrong, what was expected.
//   pieces   the text split at its blanks
//   values   what is typed by blank index
//   marked   [{ index, expected, typed, correct }] or null
export function BlankedText({ id, pieces, values, marked, onType, inline = true }) {
  return (
    <span className={cn('leading-[2.6]', inline ? '' : 'block whitespace-pre-wrap')}>
      {pieces.map((piece, index) => (
        <span key={index}>
          {piece}
          {index < pieces.length - 1 ? (
            marked ? (
              <span
                className={cn(
                  'mx-1 inline-block rounded border px-2 py-0.5 align-baseline font-medium',
                  marked[index]?.correct ? 'border-success bg-success/10 text-success' : 'border-destructive bg-destructive/10 text-destructive',
                )}
              >
                {marked[index]?.typed || '…'}
                {marked[index] && !marked[index].correct ? <span className="ml-1 text-muted-foreground line-through">{marked[index].expected}</span> : null}
              </span>
            ) : (
              <Input
                aria-label={`Blank ${index + 1}`}
                className="mx-1 inline-block h-8 w-32 align-baseline"
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                value={values[index] || ''}
                onChange={(event) => onType(index, event.target.value)}
              />
            )
          ) : null}
        </span>
      ))}
    </span>
  );
}

// One question of a Listening course lesson (F05C). Multiple choice: before
// it is checked the learner picks an option; once checked (`marked`), the
// right option shows in green, a wrong choice in red, with the explanation.
// A sentence to complete (D109): the learner writes the words heard in its
// blanks (`answers` by courseBlankKey, `onType`); once checked each blank is
// marked.
//   question  { id, kind, skill, prompt, options: [{ id, text }], blankCount }
//   chosen    the option id picked
//   marked    { chosenOptionId, correctOptionId, correct, explanation } or
//             { blanks, correct, explanation }, or null
export function CourseQuestion({ number, question, chosen, marked, onChoose, answers = {}, onType }) {
  const picked = marked ? marked.chosenOptionId : chosen;
  if (question.kind === 'complete') {
    const values = Array.from(
      { length: question.blankCount },
      (_, index) => (marked ? marked.blanks[index]?.typed : answers[courseBlankKey(question.id, index)]) || '',
    );
    return (
      <div className="space-y-2">
        <p className="font-medium">
          {number ? `${number}. ` : ''}
          <BlankedText
            id={question.id}
            pieces={question.prompt.split(FILL_IN_BLANK)}
            values={values}
            marked={marked ? marked.blanks : null}
            onType={(index, value) => onType(courseBlankKey(question.id, index), value)}
          />
        </p>
        {marked ? (
          <p className="text-sm">
            <span className={cn('font-semibold', marked.correct ? 'text-success' : 'text-destructive')}>{marked.correct ? 'Right.' : 'Not quite.'}</span>{' '}
            {marked.explanation ? <span className="text-muted-foreground">{marked.explanation}</span> : null}
          </p>
        ) : null}
      </div>
    );
  }
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

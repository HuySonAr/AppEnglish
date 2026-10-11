import { useState } from 'react';
import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { submitFillIn } from '../api/lessons-api.js';

// One passage with blanks; each blank is filled with a word of the lesson.
// Every blank must be right; the wrong ones are marked and the learner tries
// again. onPassed is called once all are right.
export function FillInExercise({ lessonId, fillIn, onPassed }) {
  const [answers, setAnswers] = useState(() => Array(fillIn.blankCount).fill(''));
  const [wrongBlanks, setWrongBlanks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [passed, setPassed] = useState(false);
  const pieces = fillIn.passage.split(FILL_IN_BLANK);

  function choose(index, word) {
    setAnswers((current) => current.map((answer, position) => (position === index ? word : answer)));
    setWrongBlanks((current) => current.filter((blank) => blank !== index));
  }

  async function check() {
    setBusy(true);
    try {
      const result = (await submitFillIn(lessonId, answers)).data;
      setWrongBlanks(result.wrongBlanks);
      if (result.passed) {
        setPassed(true);
        notify({ title: 'All correct' });
        onPassed();
      } else {
        notify({
          title: `${result.wrongBlanks.length} of ${result.total} to fix`,
          description: 'Change the marked blanks and check again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      notify({ title: 'Could not check the answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Fill each blank with a word of this lesson. All {fillIn.blankCount} must be right; you can try as often as you need.
      </p>
      <div className="whitespace-pre-wrap rounded-xl border bg-card p-4 leading-[3] shadow-sm sm:p-5">
        {pieces.map((piece, index) => (
          <span key={index}>
            {piece}
            {index < pieces.length - 1 ? (
              <span className="mx-1 inline-block w-44 max-w-full align-middle">
                <Select value={answers[index] || undefined} disabled={passed} onValueChange={(word) => choose(index, word)}>
                  <SelectTrigger
                    aria-label={`Blank ${index + 1}`}
                    className={cn(
                      'h-9 font-medium',
                      wrongBlanks.includes(index) && 'border-destructive text-destructive',
                      answers[index] && !wrongBlanks.includes(index) && 'border-primary/50 bg-primary/5',
                    )}
                  >
                    <SelectValue placeholder={`(${index + 1}) choose…`} />
                  </SelectTrigger>
                  <SelectContent>
                    {fillIn.wordBank.map((word) => (
                      <SelectItem key={word} value={word}>
                        {word}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || passed || answers.some((answer) => !answer)} onClick={check}>
          {busy ? 'Checking…' : 'Check answers'}
        </Button>
        {wrongBlanks.length ? (
          <span className="text-sm text-destructive">
            Wrong: blank {wrongBlanks.map((index) => index + 1).join(', ')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { submitFillIn } from '../api/lessons-api.js';
import { answersOf, availableChips, emptyPlacement, tapBlank, tapChip } from '../lib/fill-in.js';

// One passage with blanks and the words to place (D111): the learner taps a
// word, then the blank it belongs in (or the blank first, then the word). A
// placed word leaves the bank; tapping a filled blank gives it back. Every
// blank must be right; the wrong ones are marked and the learner tries again.
// onPassed is called once all are right.
export function FillInExercise({ lessonId, fillIn, onPassed }) {
  const [state, setState] = useState(() => ({ placed: emptyPlacement(fillIn.blankCount), selectedChip: null, selectedBlank: null }));
  const [wrongBlanks, setWrongBlanks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [passed, setPassed] = useState(false);
  const pieces = fillIn.passage.split(FILL_IN_BLANK);
  const bank = availableChips(fillIn.wordBank, state.placed);
  const filled = state.placed.filter((chip) => chip !== null).length;

  function onChip(chip) {
    if (passed) return;
    setState((current) => tapChip(current, chip));
  }

  function onBlank(blank) {
    if (passed) return;
    setState((current) => tapBlank(current, blank));
    setWrongBlanks((current) => current.filter((index) => index !== blank));
  }

  function reset() {
    setState({ placed: emptyPlacement(fillIn.blankCount), selectedChip: null, selectedBlank: null });
    setWrongBlanks([]);
  }

  async function check() {
    setBusy(true);
    try {
      const result = (await submitFillIn(lessonId, answersOf(fillIn.wordBank, state.placed))).data;
      setWrongBlanks(result.wrongBlanks);
      if (result.passed) {
        setPassed(true);
        notify({ title: 'All correct' });
        onPassed();
      } else {
        notify({
          title: `${result.wrongBlanks.length} of ${result.total} to fix`,
          description: 'Tap a marked blank to take its word back, then place the right one.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      notify({ title: 'Could not check the answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const hint =
    state.selectedChip !== null
      ? `"${fillIn.wordBank[state.selectedChip]}" chosen: tap the blank it belongs in.`
      : state.selectedBlank !== null
        ? `Blank ${state.selectedBlank + 1} chosen: tap the word that belongs there.`
        : 'Tap a word, then the blank it belongs in. Tap a filled blank to take the word back.';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Place every word in the right blank. All {fillIn.blankCount} must be right; you can try as often as you need.
      </p>

      {/* The words still to place. */}
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <ul aria-label="Words to place" className="flex min-h-11 flex-wrap items-center gap-2">
          {bank.length ? (
            bank.map(({ chip, word }) => (
              <li key={chip}>
                <button
                  type="button"
                  aria-pressed={state.selectedChip === chip}
                  disabled={passed}
                  onClick={() => onChip(chip)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    state.selectedChip === chip ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
                    passed && 'opacity-60',
                  )}
                >
                  {word}
                </button>
              </li>
            ))
          ) : (
            <li className="px-1 text-sm text-muted-foreground">{passed ? 'Every word is in place.' : 'All words placed. Check your answers.'}</li>
          )}
        </ul>
      </div>

      <div className="whitespace-pre-wrap rounded-xl border bg-card p-4 leading-[3] shadow-sm sm:p-5">
        {pieces.map((piece, index) => {
          if (index === pieces.length - 1) return <span key={index}>{piece}</span>;
          const chip = state.placed[index];
          const wrong = wrongBlanks.includes(index);
          const selected = state.selectedBlank === index;
          return (
            <span key={index}>
              {piece}
              <button
                type="button"
                aria-label={chip === null ? `Blank ${index + 1}, empty` : `Blank ${index + 1}: ${fillIn.wordBank[chip]}`}
                aria-pressed={selected}
                disabled={passed}
                onClick={() => onBlank(index)}
                className={cn(
                  'mx-1 inline-flex h-9 min-w-[7rem] items-center justify-center rounded-lg border px-3 align-middle text-sm font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  chip === null ? 'border-dashed text-muted-foreground hover:bg-accent' : 'border-primary/50 bg-primary/5 hover:bg-primary/10',
                  selected && 'border-primary ring-2 ring-primary/40',
                  state.selectedChip !== null && 'border-primary/70 hover:bg-primary/10',
                  wrong && 'border-destructive bg-destructive/5 text-destructive',
                  passed && 'border-success/50 bg-success/5 text-foreground',
                )}
              >
                {chip === null ? `(${index + 1})` : fillIn.wordBank[chip]}
              </button>
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={busy || passed || filled < fillIn.blankCount} onClick={check}>
          {busy ? 'Checking…' : 'Check answers'}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {filled} of {fillIn.blankCount} placed
        </span>
        {!passed && filled > 0 ? (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Start over
          </Button>
        ) : null}
        {wrongBlanks.length ? (
          <span className="text-sm text-destructive">
            Wrong: blank {wrongBlanks.map((index) => index + 1).join(', ')}
          </span>
        ) : null}
      </div>
      {!passed ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

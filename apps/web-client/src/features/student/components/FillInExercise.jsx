import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { submitFillIn } from '../api/lessons-api.js';
import { answersOf, availableChips, emptyPlacement, tapBlank, tapChip } from '../lib/fill-in.js';

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
      <div className="sticky top-16 z-10 rounded-2xl border bg-card/95 p-3 shadow-xs backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-3 px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Words</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(filled * 100) / fillIn.blankCount}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {filled}/{fillIn.blankCount}
          </span>
        </div>
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
                    'rounded-full border-2 px-4 py-1.5 text-base font-medium shadow-xs transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                    state.selectedChip === chip ? 'scale-105 border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/40 hover:bg-accent',
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

      <div className="whitespace-pre-wrap rounded-2xl border bg-card p-5 text-lg leading-[3.2] shadow-xs sm:p-7">
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
                  'mx-1 inline-flex h-10 min-w-28 items-center justify-center rounded-lg border-2 px-3 align-middle text-base font-medium leading-none transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
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

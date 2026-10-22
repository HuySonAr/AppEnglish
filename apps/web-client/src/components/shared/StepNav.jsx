import { Check, Lock } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export const StepState = Object.freeze({ DONE: 'done', TODO: 'todo', LOCKED: 'locked' });

export function StepNav({ steps, active, onSelect, label }) {
  return (
    <nav aria-label={label} className="overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center">
        {steps.map((step, index) => {
          const current = step.key === active;
          const locked = step.state === StepState.LOCKED;
          const done = step.state === StepState.DONE;
          return (
            <li key={step.key} className="flex items-center">
              {index ? <span aria-hidden="true" className={cn('mx-1 h-0.5 w-6 rounded-full sm:mx-2 sm:w-10', done || current ? 'bg-primary/60' : 'bg-border')} /> : null}
              <button
                type="button"
                disabled={locked}
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelect(step.key)}
                className={cn(
                  'group flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  current ? 'bg-primary/10 text-foreground' : locked ? 'cursor-not-allowed text-muted-foreground opacity-60' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums transition-colors',
                    current ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-success bg-success text-white' : 'border-border bg-background',
                  )}
                >
                  {done && !current ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

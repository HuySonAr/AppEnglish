import { cn } from '../../../lib/utils.js';
import { TOEIC_MODES, toeicModeLabels } from '../lib/listening-practice.js';

export function ModeSwitch({ mode, onChange, className }) {
  return (
    <div className={cn('inline-flex rounded-full border bg-muted/40 p-0.5', className)} role="group" aria-label="Words to hide">
      {TOEIC_MODES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mode === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {toeicModeLabels[value]}
        </button>
      ))}
    </div>
  );
}

import { cn } from '../../../lib/utils.js';
import { wordHint, wordMeter } from '../lib/writing.js';

const fills = { empty: 'bg-muted-foreground/40', short: 'bg-warning', ok: 'bg-success', long: 'bg-destructive' };
const tones = { empty: 'text-muted-foreground', short: 'text-warning', ok: 'text-success', long: 'text-destructive' };

export function WordMeter({ words, min, max }) {
  const meter = wordMeter(words, min, max);
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="relative h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="absolute inset-y-0 bg-success/15" style={{ left: `${meter.zoneStart}%`, width: `${meter.zoneEnd - meter.zoneStart}%` }} />
        <div className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-200', fills[meter.state])} style={{ width: `${meter.fill}%` }} />
        <div className="absolute inset-y-0 w-px bg-success/60" style={{ left: `${meter.zoneStart}%` }} />
        <div className="absolute inset-y-0 w-px bg-success/60" style={{ left: `${meter.zoneEnd}%` }} />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs" aria-live="polite">
        <span className={cn('font-semibold tabular-nums', tones[meter.state])}>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span className="text-muted-foreground">{wordHint(words, min, max)}</span>
      </p>
    </div>
  );
}

import { cn } from '../../../lib/utils.js';
import { scoreTone, toneBar, toneText } from '../lib/practice.js';

export function ScoreBar({ label, value, max = 10 }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full', toneBar[scoreTone(value, max)])} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export function ScoreSummary({ total, max = 10, bars }) {
  return (
    <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
      <div className="text-center sm:border-r sm:pr-5">
        <p className={cn('text-5xl font-bold tabular-nums tracking-tight', toneText[scoreTone(total, max)])}>{total.toFixed(1)}</p>
        <p className="text-sm text-muted-foreground">out of {max}</p>
      </div>
      <div className="space-y-3">
        {bars.map((bar) => (
          <ScoreBar key={bar.label} label={bar.label} value={bar.value} max={bar.max ?? max} />
        ))}
      </div>
    </div>
  );
}

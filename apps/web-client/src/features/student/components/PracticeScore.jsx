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

export function EtsScore({ ets }) {
  if (!ets) return null;
  const score = Number.isInteger(ets.score) ? ets.score : ets.score.toFixed(1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium">TOEIC score estimate</p>
        {ets.pronunciation !== undefined ? (
          <p className="text-xs text-muted-foreground">
            Pronunciation {ets.pronunciation}/3 · Intonation {ets.intonation}/3
          </p>
        ) : null}
      </div>
      <p className="tabular-nums">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-sm text-muted-foreground"> / {ets.max}</span>
      </p>
    </div>
  );
}

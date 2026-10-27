import { Timer } from 'lucide-react';
import { Label } from '../../../components/ui';
import { Switch } from '../../../components/ui/switch.jsx';
import { cn } from '../../../lib/utils.js';
import { etsTimingParts } from '../../../lib/practice-prompts.js';
import { formatClock } from '../lib/practice.js';

export function TimerSwitch({ checked, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Switch id="practice-no-timer" checked={checked} onCheckedChange={onChange} />
      <Label htmlFor="practice-no-timer" className="cursor-pointer text-sm font-normal">
        Practice without timer
      </Label>
    </div>
  );
}

export function TimingBadges({ task }) {
  const parts = etsTimingParts(task);
  if (!parts.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      {parts.map((part) => (
        <span key={part.label} className="rounded-md bg-muted px-2 py-1">
          {part.label} <span className="font-medium tabular-nums text-foreground">{part.value}</span>
        </span>
      ))}
    </div>
  );
}

export function Countdown({ label, left, total, tone = 'primary', children }) {
  const percent = total ? Math.min(100, Math.max(0, (left / total) * 100)) : 0;
  return (
    <div className="space-y-3 text-center" role="timer" aria-live="off">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn('text-4xl font-semibold tabular-nums', tone === 'warning' ? 'text-warning' : 'text-primary')}>{formatClock(Math.ceil(left))}</p>
      <div className="mx-auto h-1.5 max-w-sm overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full transition-[width] duration-200', tone === 'warning' ? 'bg-warning' : 'bg-primary')} style={{ width: `${percent}%` }} />
      </div>
      {children}
    </div>
  );
}

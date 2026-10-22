import { cn } from '../../../lib/utils.js';

const tones = {
  primary: 'text-primary',
  success: 'text-success',
  destructive: 'text-destructive',
};

export function ScoreRing({ percent, tone = 'primary', size = 144, label }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circle = 2 * Math.PI * radius;
  const empty = percent === null || percent === undefined;
  const value = empty ? 0 : Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circle}
          strokeDashoffset={circle * (1 - value / 100)}
          className={cn('stroke-current transition-[stroke-dashoffset] duration-700', tones[tone])}
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <span className={cn('font-bold tabular-nums tracking-tight', size < 120 ? 'text-3xl' : 'text-4xl', empty ? 'text-muted-foreground' : tones[tone])}>{empty ? '—' : `${value}%`}</span>
        {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
      </span>
    </div>
  );
}

import { useLayoutEffect, useRef } from 'react';
import { animate } from 'animejs';
import { cn } from '../../../lib/utils.js';
import { prefersReducedMotion } from '../../../lib/motion.js';
import { CountUp } from '../../../components/shared/CountUp.jsx';

const tones = {
  primary: { text: 'text-primary', track: 'stroke-muted', label: 'text-muted-foreground' },
  success: { text: 'text-success', track: 'stroke-muted', label: 'text-muted-foreground' },
  destructive: { text: 'text-destructive', track: 'stroke-muted', label: 'text-muted-foreground' },
  inverse: { text: 'text-primary-foreground', track: 'stroke-primary-foreground/20', label: 'text-primary-foreground/75' },
};

const asPercent = (value) => `${value}%`;

export function ScoreRing({ percent, tone = 'primary', size = 144, label }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circle = 2 * Math.PI * radius;
  const empty = percent === null || percent === undefined;
  const value = empty ? 0 : Math.max(0, Math.min(100, Number(percent) || 0));
  const offset = circle * (1 - value / 100);
  const look = tones[tone] || tones.primary;
  const arc = useRef(null);
  const drawn = useRef(circle);

  useLayoutEffect(() => {
    const node = arc.current;
    if (!node) return undefined;
    if (prefersReducedMotion()) {
      drawn.current = offset;
      return undefined;
    }
    node.setAttribute('stroke-dashoffset', String(drawn.current));
    const run = animate(node, {
      strokeDashoffset: [drawn.current, offset],
      duration: 1300,
      ease: 'outExpo',
      onComplete: () => {
        drawn.current = offset;
      },
    });
    return () => run.pause();
  }, [offset]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={look.track} />
        <circle
          ref={arc}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circle}
          strokeDashoffset={offset}
          className={cn('stroke-current', look.text)}
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <span className={cn('font-bold tabular-nums tracking-tight', size < 120 ? 'text-3xl' : 'text-4xl', empty && tone !== 'inverse' ? 'text-muted-foreground' : look.text)}>
          {empty ? '—' : <CountUp value={value} format={asPercent} duration={1300} />}
        </span>
        {label ? <span className={cn('text-xs', look.label)}>{label}</span> : null}
      </span>
    </div>
  );
}

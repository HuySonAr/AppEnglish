import { useLayoutEffect, useRef } from 'react';
import { animate } from 'animejs';
import { prefersReducedMotion } from '../../lib/motion.js';

const plain = (value) => String(value);

export function CountUp({ value, format = plain, duration = 1100 }) {
  const ref = useRef(null);
  const shown = useRef(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !Number.isFinite(value)) return undefined;
    if (prefersReducedMotion()) {
      shown.current = value;
      node.textContent = format(value);
      return undefined;
    }
    const state = { n: shown.current };
    node.textContent = format(Math.round(state.n));
    const run = animate(state, {
      n: value,
      duration,
      ease: 'outExpo',
      onUpdate: () => {
        node.textContent = format(Math.round(state.n));
      },
      onComplete: () => {
        shown.current = value;
        node.textContent = format(value);
      },
    });
    return () => run.pause();
  }, [value]);

  return <span ref={ref}>{format(value)}</span>;
}

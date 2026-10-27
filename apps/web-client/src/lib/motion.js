export const EASE_OUT = [0.22, 1, 0.36, 1];

export const revealGroup = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const revealItem = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function percentOf(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (Number(value) * 100) / total));
}

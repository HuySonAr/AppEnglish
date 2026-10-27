import { motion } from 'motion/react';
import { EASE_OUT, percentOf } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';

export function ProgressBar({ value, total = 100, className, barClassName }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)} aria-hidden="true">
      <motion.div className={cn('h-full rounded-full bg-primary', barClassName)} initial={{ width: 0 }} animate={{ width: `${percentOf(value, total)}%` }} transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }} />
    </div>
  );
}

import { motion } from 'motion/react';
import { revealGroup, revealItem } from '../../lib/motion.js';

export function RevealGroup({ className, children }) {
  return (
    <motion.div className={className} variants={revealGroup} initial="hidden" animate="shown">
      {children}
    </motion.div>
  );
}

export function RevealItem({ className, children }) {
  return (
    <motion.div className={className} variants={revealItem}>
      {children}
    </motion.div>
  );
}

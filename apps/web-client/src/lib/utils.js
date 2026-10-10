import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Joins class names (strings, arrays, { class: condition } objects) and lets
// a later Tailwind class override an earlier conflicting one.
export function cn(...values) {
  return twMerge(clsx(values));
}

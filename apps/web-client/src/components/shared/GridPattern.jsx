import { useId } from 'react';
import { cn } from '../../lib/utils.js';

export function GridPattern({ className, size = 32 }) {
  const id = useId();
  return (
    <svg className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden="true">
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M${size} 0H0V${size}`} fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

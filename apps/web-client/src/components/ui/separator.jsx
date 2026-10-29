import * as React from 'react';
import { cn } from '../../lib/utils.js';

export function Separator({ className, orientation = 'horizontal', decorative = true, ...props }) {
  return (
    <hr
      aria-orientation={orientation}
      aria-hidden={decorative}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  );
}
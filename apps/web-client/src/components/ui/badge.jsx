import * as React from 'react';
import { cn } from '../../lib/utils.js';

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        {
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80':
            variant === 'default',
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80':
            variant === 'secondary',
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80':
            variant === 'destructive',
          'border-transparent bg-green-500/20 text-green-500 hover:bg-green-500/30':
            variant === 'success',
          'border-transparent bg-amber-500/20 text-amber-500 hover:bg-amber-500/30':
            variant === 'warning',
          'border-transparent bg-sky-500/20 text-sky-500 hover:bg-sky-500/30':
            variant === 'info',
          'border-transparent bg-muted text-muted-foreground hover:bg-muted/80':
            variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
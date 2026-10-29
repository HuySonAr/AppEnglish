import { useState } from 'react';
import { cn } from '../../../lib/utils.js';

const face = 'absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border p-4 text-center backface-hidden';

export function WordFlipCard({ label, front, back, highlight = false, onFlip, className }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={cn('h-44 perspective-[1000px]', className)}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={flipped}
        onClick={() => {
          setFlipped(!flipped);
          onFlip?.(!flipped);
        }}
        className="relative h-full w-full rounded-2xl transition-transform duration-500 transform-3d focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        <span className={cn(face, 'bg-card shadow-xs', highlight && 'border-success/50')}>{front}</span>
        <span className={cn(face, 'bg-primary/5 shadow-xs')} style={{ transform: 'rotateY(180deg)' }}>
          {back}
        </span>
      </button>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.js';

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function CircleSwapLink({ to, state, children, className }) {
  return (
    <Link to={to} state={state} className={cn('circle-swap', className)}>
      <span className="whitespace-nowrap">{children}</span>
      <span className="circle-swap__dot" aria-hidden="true" />
      <span className="circle-swap__arrow" aria-hidden="true">
        <Arrow />
      </span>
    </Link>
  );
}

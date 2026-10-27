import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.js';

export function ArrowLink({ to, state, children, className }) {
  return (
    <Link to={to} state={state} className={cn('arrow-link', className)}>
      <span className="arrow-link__copy">{children}</span>
      <span className="arrow-link__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

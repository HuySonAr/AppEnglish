import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.js';

// Logo and product name. compact hides the name on narrow screens.
export function Brand({ to = '/', compact = false, className }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="h-5 w-5" />
      </span>
      <span className={cn('text-lg', compact && 'hidden sm:inline')}>AppEnglish</span>
    </Link>
  );
}

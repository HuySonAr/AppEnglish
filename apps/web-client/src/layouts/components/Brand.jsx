import { Link } from 'react-router-dom';
import { GraduationLogo } from '../../components/illustrations';
import { cn } from '../../lib/utils.js';

export function Brand({ to = '/', compact = false, className }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <GraduationLogo className="h-9 w-9 shrink-0" />
      <span className={cn('text-lg', compact && 'hidden sm:inline')}>AppEnglish</span>
    </Link>
  );
}

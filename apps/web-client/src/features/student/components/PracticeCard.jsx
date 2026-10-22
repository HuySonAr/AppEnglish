import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils.js';

const tones = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  primary: 'bg-primary/10 text-primary',
};

export function PracticeCard({ to, icon: Icon, title, description, done = 0, total = 0, unit, tone = 'primary' }) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-4 border-b px-5 py-5">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', tones[tone])}>
          <Icon className="h-6 w-6" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">{title}</h2>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-auto space-y-1.5">
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>
              {total} {unit}
              {total === 1 ? '' : 's'}
            </span>
            <span>{done} tried</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${total ? (done * 100) / total : 0}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

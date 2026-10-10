import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/badge.jsx';
import { cn } from '../../lib/utils.js';

const tones = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

// Dashboard tile. With `to` the whole tile is a link; without it the tile
// shows a feature that is not available yet.
export function FeatureCard({
  icon: Icon,
  title,
  description,
  to,
  tone = 'primary',
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {to ? (
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        ) : (
          <Badge variant="outline">Coming soon</Badge>
        )}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </>
  );
  const frame = 'block rounded-xl border bg-card p-5 shadow-sm';
  return to ? (
    <Link
      to={to}
      className={cn(
        frame,
        'group transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(frame, 'opacity-80')}>{body}</div>
  );
}

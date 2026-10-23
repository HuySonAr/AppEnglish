import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils.js';

export function SectionNav({ label, groups, active, onChoose }) {
  return (
    <nav aria-label={label} className="rounded-xl border bg-card p-2 shadow-sm lg:sticky lg:top-36">
      {groups.map((group) => (
        <div key={group.label} className="py-1">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {group.items.map((item) => {
              const current = item.key === active;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onChoose(item.key)}
                  className={cn(
                    'w-full space-y-1.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    current ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    {item.issues ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {item.issues}
                      </span>
                    ) : item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : null}
                  </span>
                  {item.detail ? <span className="block truncate text-xs tabular-nums text-muted-foreground">{item.detail}</span> : null}
                  {item.progress !== undefined ? (
                    <span className="block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className={cn('block h-full rounded-full', item.done ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

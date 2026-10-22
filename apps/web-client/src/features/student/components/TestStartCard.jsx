import { cn } from '../../../lib/utils.js';

export function TestStartCard({ icon: Icon, eyebrow, title, badges, stats, note, children, className }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-card shadow-sm', className)}>
      <div className="flex items-center gap-4 bg-primary/5 px-6 py-5">
        {Icon ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Icon className="h-6 w-6" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p> : null}
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {badges ? <div className="flex flex-wrap justify-end gap-2">{badges}</div> : null}
      </div>
      <div className="space-y-5 p-6">
        {stats?.length ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-background p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {stat.icon ? <stat.icon className="h-3.5 w-3.5" /> : null}
                  {stat.label}
                </dt>
                <dd className={cn('mt-1 text-xl font-bold tabular-nums', stat.tone)}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
      </div>
    </div>
  );
}

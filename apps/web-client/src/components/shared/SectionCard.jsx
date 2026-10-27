import { cn } from '../../lib/utils.js';
import { ArrowLink } from './ArrowLink.jsx';

export function SectionCard({ title, icon: Icon, action, aside, className, children }) {
  return (
    <section className={cn('rounded-3xl border bg-card p-5 sm:p-6', className)}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            {Icon ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            {title}
          </h2>
          {action ? <ArrowLink to={action.to}>{action.label}</ArrowLink> : aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

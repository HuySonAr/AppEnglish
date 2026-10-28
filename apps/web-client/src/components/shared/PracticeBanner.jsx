import { cn } from '../../lib/utils.js';

const tones = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function PracticeBanner({ eyebrow, eyebrowIcon: EyebrowIcon, title, accent, description, features = [], image, className }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex items-center gap-4 p-4 sm:gap-6 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {title} {accent ? <span className="text-primary">{accent}</span> : null}
          </h1>
          {description ? <p className="text-sm text-muted-foreground sm:text-base">{description}</p> : null}
          {features.length ? (
            <ul className="hidden flex-wrap gap-x-6 gap-y-2 pt-2 md:flex">
              {features.map(({ icon: Icon, title: label, note, tone = 'primary' }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tones[tone])}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-muted-foreground">{note}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {image ? <img src={image} alt="" aria-hidden="true" className="h-20 w-auto shrink-0 select-none rounded-lg sm:h-28 lg:h-36" draggable="false" /> : null}
      </div>
    </div>
  );
}

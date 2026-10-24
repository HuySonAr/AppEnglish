import { useMemo } from 'react';

const BAR_HEIGHTS = [14, 26, 18, 34, 22, 40, 28, 18, 32, 20, 12];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MicGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

function BookGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 5.5c2.8-1.2 5.6-1.2 8.5 0v13c-2.9-1.2-5.7-1.2-8.5 0z" />
      <path d="M20.5 5.5c-2.8-1.2-5.6-1.2-8.5 0v13c2.9-1.2 5.7-1.2 8.5 0z" />
    </svg>
  );
}

function PenGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M14.5 4.5l5 5L9 20H4v-5z" />
      <path d="M12.5 6.5l5 5" />
    </svg>
  );
}

function FlameGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.6 2.4c.4 2.6-.6 4.3-2 5.9C9 10 7.5 11.7 7.5 14.6A4.6 4.6 0 0 0 12 19.5a4.7 4.7 0 0 0 4.7-4.8c0-1.6-.6-2.8-1.4-3.9-.1 1.2-.7 2.2-1.6 2.6.5-3.3-.2-7.6-1.1-11z" />
    </svg>
  );
}

function Pattern() {
  return (
    <svg className="absolute inset-0 h-full w-full text-primary-foreground/[0.07]" aria-hidden="true">
      <defs>
        <pattern id="auth-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-grid)" />
    </svg>
  );
}

function Initial({ letter, tone, className }) {
  return <span className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-primary text-sm font-semibold ${tone} ${className || ''}`}>{letter}</span>;
}

export function AuthShowcase() {
  const week = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return DAYS.map((name, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return { name, date: day.getDate(), today: index === today.getDay(), done: index < today.getDay() };
    });
  }, []);

  return (
    <div className="relative flex h-full min-h-[34rem] overflow-hidden rounded-[2rem] bg-primary text-primary-foreground">
      <Pattern />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex h-56 w-56 items-center justify-center">
          <span className="auth-ring absolute inset-0 rounded-full border-2 border-primary-foreground/40" />
          <span className="auth-ring absolute inset-0 rounded-full border-2 border-primary-foreground/40" style={{ animationDelay: '0.9s' }} />
          <span className="auth-ring absolute inset-0 rounded-full border-2 border-primary-foreground/40" style={{ animationDelay: '1.8s' }} />
          <span className="relative flex h-36 w-36 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-2xl">
            <MicGlyph className="h-14 w-14" />
          </span>
        </div>
      </div>

      <div className="auth-pop absolute left-8 top-8" style={{ animationDelay: '0.25s' }}>
        <div className="auth-float rounded-2xl bg-card p-4 text-card-foreground shadow-xl" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookGlyph className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Today&apos;s lesson</span>
              <span className="block text-xs text-muted-foreground">Unit 4 · At the airport</span>
            </span>
          </div>
          <div className="mt-3 flex h-10 items-center gap-1" aria-hidden="true">
            {BAR_HEIGHTS.map((height, index) => (
              <span key={index} className="auth-wave w-1.5 rounded-full bg-primary/70" style={{ height, animationDelay: `${index * 0.09}s` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="auth-pop absolute right-8 top-24" style={{ animationDelay: '0.45s' }}>
        <div className="auth-float flex -space-x-3" style={{ animationDelay: '1.4s' }}>
          <Initial letter="L" tone="bg-warning text-white" />
          <Initial letter="M" tone="bg-success text-white" />
          <Initial letter="A" tone="bg-card text-primary" />
        </div>
      </div>

      <div className="auth-pop absolute bottom-36 right-8" style={{ animationDelay: '0.65s' }}>
        <div className="auth-float w-56 rounded-2xl bg-card p-4 text-card-foreground shadow-xl" style={{ animationDelay: '0.8s' }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <PenGlyph className="h-4 w-4 text-primary" />
              Writing feedback
            </span>
            <span className="text-sm font-bold tabular-nums text-success">4.2</span>
          </div>
          <div className="mt-3 space-y-2" aria-hidden="true">
            {[86, 72, 90, 64].map((width, index) => (
              <div key={index} className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-pop absolute inset-x-8 bottom-8" style={{ animationDelay: '0.85s' }}>
        <div className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary-foreground/80">
            <FlameGlyph className="h-3.5 w-3.5 text-warning" />
            Your week
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {week.map((day) => (
              <div key={day.name} className={`rounded-xl py-1.5 ${day.today ? 'bg-primary-foreground text-primary' : ''}`}>
                <span className={`block text-[11px] ${day.today ? 'text-primary/70' : 'text-primary-foreground/70'}`}>{day.name}</span>
                <span className="block text-lg font-semibold tabular-nums">{day.date}</span>
                <span className={`mx-auto mt-0.5 block h-1 w-1 rounded-full ${day.done ? 'bg-warning' : 'bg-transparent'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

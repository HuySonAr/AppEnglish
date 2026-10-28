import { Link, Outlet, useLocation } from 'react-router-dom';
import logoUrl from '../svg/graduation.svg';
import { cn } from '../lib/utils.js';
import { AuthShowcase } from './components/AuthShowcase.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';

export const AUTH_SIDE_RIGHT = 'right';
const SLIDE = 'transition-transform duration-700 [transition-timing-function:cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none';

export function AuthLayout() {
  const location = useLocation();
  const swapped = location.pathname === '/register' || location.state?.authSide === AUTH_SIDE_RIGHT;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/70 p-3 sm:p-6 lg:h-dvh lg:overflow-hidden lg:p-8">
      <div className="auth-rise grid w-full max-w-6xl overflow-hidden rounded-[2rem] border bg-card shadow-2xl shadow-foreground/5 sm:rounded-[2.5rem] lg:h-[min(46rem,calc(100dvh-4rem))] lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        <section className={cn('relative z-10 flex min-h-0 flex-col bg-card auth-scroll px-6 py-6 sm:px-10 sm:py-8 lg:overflow-y-auto short:py-5', SLIDE, swapped && 'lg:translate-x-full')}>
          <header className="flex items-center justify-between">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 pr-4 text-base font-semibold tracking-tight transition-colors hover:bg-accent">
              <img src={logoUrl} alt="" className="h-7 w-7" />
              AppEnglish
            </Link>
            <ThemeToggle />
          </header>
          <div className="flex flex-1 items-center justify-center py-6 short:py-3">
            <Outlet />
          </div>
        </section>
        <aside className={cn('hidden min-h-0 p-3 lg:block', SLIDE, swapped && 'lg:-translate-x-full')}>
          <AuthShowcase />
        </aside>
      </div>
    </div>
  );
}

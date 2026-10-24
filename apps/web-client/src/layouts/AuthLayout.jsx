import { Link, Outlet } from 'react-router-dom';
import { AuthShowcase } from './components/AuthShowcase.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';

function LogoMark(props) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="10" className="fill-primary" />
      <path d="M8 21.5 16 9l8 12.5" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.2 17h9.6" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/70 p-3 sm:p-6 lg:p-8">
      <div className="auth-rise grid w-full max-w-6xl overflow-hidden rounded-[2rem] border bg-card shadow-2xl shadow-foreground/5 sm:rounded-[2.5rem] lg:min-h-[min(46rem,calc(100vh-4rem))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="flex flex-col px-6 py-6 sm:px-10 sm:py-8">
          <header className="flex items-center justify-between">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 pr-4 text-base font-semibold tracking-tight transition-colors hover:bg-accent">
              <LogoMark className="h-7 w-7" />
              AppEnglish
            </Link>
            <ThemeToggle />
          </header>
          <div className="flex flex-1 items-center justify-center py-10">
            <Outlet />
          </div>
        </section>
        <aside className="hidden p-3 lg:block">
          <AuthShowcase />
        </aside>
      </div>
    </div>
  );
}

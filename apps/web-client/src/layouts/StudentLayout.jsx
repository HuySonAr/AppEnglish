import { Link, Outlet, useLocation } from 'react-router-dom';
import { isNavItemActive, navigation } from '../app/navigation.js';
import { Roles } from '../constants/auth.js';
import { cn } from '../lib/utils.js';
import { Brand } from './components/Brand.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { UserMenu } from './components/UserMenu.jsx';

// Learner space: a light top bar and a centred column, with the menu as tabs
// on wide screens and as a bottom bar on phones.
export function StudentLayout() {
  const { home, items } = navigation[Roles.STUDENT];
  const { pathname } = useLocation();
  const links = (navClass, itemClass) => (
    <nav aria-label="Student navigation" className={navClass}>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              itemClass,
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4 sm:px-6">
          <Brand to={home} />
          {links(
            'hidden items-center gap-1 sm:flex',
            'rounded-lg px-3 py-2 text-sm',
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      {links(
        'fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-card/95 px-2 py-2 backdrop-blur sm:hidden',
        'flex-col gap-1 rounded-lg px-5 py-1.5 text-xs',
      )}
    </div>
  );
}

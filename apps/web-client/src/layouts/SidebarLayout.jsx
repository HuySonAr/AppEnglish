import { useState } from 'react';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { displayNameOf } from '@appenglish/auth-contracts';
import { navigation } from '../app/navigation.js';
import { RoleLabels } from '../constants/auth.js';
import { cn } from '../lib/utils.js';
import { Button } from '../components/ui/button.jsx';
import { Switch } from '../components/ui/switch.jsx';
import { useTheme } from '../hooks/use-theme.js';
import { Avatar } from '../components/shared/Avatar.jsx';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { dashboardPathForRole } from '../features/auth/flow/auth-flow.js';
import { canLeave } from '../lib/leave-guard.js';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../components/ui/sheet.jsx';
import { Brand } from './components/Brand.jsx';
import { SidebarNav } from './components/SidebarNav.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { UserMenu } from './components/UserMenu.jsx';

// The workspace of every role: a fixed sidebar with the role's menu on wide
// screens, a slide-in drawer on phones, and a top bar. side puts the sidebar
// on the left or the right; drawerSide (side by default) does the same for
// the phone drawer and its menu button: the student has the sidebar on the
// left like the other roles and the drawer on the right (D96).
export function SidebarLayout({ role, side = 'left', drawerSide = side }) {
  const { home, items } = navigation[role];
  const label = RoleLabels[role];
  const right = side === 'right';
  const drawerRight = drawerSide === 'right';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { account, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();
  async function logOut() {
    // A page such as a test in progress may refuse to be left.
    if (!canLeave()) return;
    await signOut();
    navigate('/login', { replace: true });
  }
  const menu = (onNavigate) => (
    <>
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <Brand to={home} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <SidebarNav items={items} label={`${label} navigation`} onNavigate={onNavigate} />
      </div>
      {/* The signed-in person (D113): picture and name link to the profile; Log out below. */}
      <div className="shrink-0 border-t p-3">
        <Link
          to={`${dashboardPathForRole(role)}/profile`}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar account={account} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{displayNameOf(account || {})}</span>
            <span className="block truncate text-xs text-muted-foreground">{account?.email}</span>
          </span>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" className="flex-1 justify-start gap-2" onClick={logOut}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
          <label
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 text-muted-foreground transition hover:text-foreground"
            title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {dark ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
            <Switch checked={dark} onCheckedChange={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} />
          </label>
        </div>
      </div>
    </>
  );
  const drawer = (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={drawerSide}>
        <SheetTitle className="sr-only">{label} menu</SheetTitle>
        <SheetDescription className="sr-only">Navigation</SheetDescription>
        {menu(() => setDrawerOpen(false))}
      </SheetContent>
    </Sheet>
  );
  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 z-30 hidden w-64 flex-col bg-card lg:flex',
          right ? 'right-0 border-l' : 'left-0 border-r',
        )}
      >
        {menu()}
      </aside>

      <div className={right ? 'lg:pr-64' : 'lg:pl-64'}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          {drawerRight ? null : drawer}
          <Brand to={home} compact className="lg:hidden" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu />
            {drawerRight ? drawer : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

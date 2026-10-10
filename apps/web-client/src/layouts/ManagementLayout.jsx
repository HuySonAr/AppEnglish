import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { navigation } from '../app/navigation.js';
import { RoleLabels } from '../constants/auth.js';
import { Button } from '../components/ui/button.jsx';
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

// Workspace for the roles that manage things (Admin, Content Manager): a fixed
// sidebar on wide screens, a slide-in drawer on phones, and a top bar.
export function ManagementLayout({ role }) {
  const { home, items } = navigation[role];
  const label = RoleLabels[role];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menu = (onNavigate) => (
    <>
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <Brand to={home} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label} workspace
        </p>
        <SidebarNav items={items} label={`${label} navigation`} onNavigate={onNavigate} />
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
        {menu()}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">{label} menu</SheetTitle>
              <SheetDescription className="sr-only">Navigation</SheetDescription>
              {menu(() => setDrawerOpen(false))}
            </SheetContent>
          </Sheet>
          <Brand to={home} compact className="lg:hidden" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { BookOpen, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { RoleLabels, Roles } from '../constants/auth.js';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';

export function RoleLayout({ role }) {
  const { account, signOut } = useAuth();
  const navigate = useNavigate();
  const label = RoleLabels[role];
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            to={`/${role.toLowerCase().replace('_', '-')}`}
            className="flex items-center gap-2 font-semibold text-foreground"
          >
            <BookOpen className="h-5 w-5 text-primary" />
            AppEnglish
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {account?.email}
            </span>
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={async () => {
                await signOut();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[12rem_1fr]">
        <nav className="space-y-2" aria-label={`${label} navigation`}>
          <NavLink
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm ${
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
            to={`/${role.toLowerCase().replace('_', '-')}`}
          >
            Dashboard
          </NavLink>
          {role === Roles.ADMIN ? (
            <NavLink
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
              to="/admin/accounts"
            >
              Accounts
            </NavLink>
          ) : null}
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
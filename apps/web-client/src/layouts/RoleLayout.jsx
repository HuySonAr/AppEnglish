import { BookOpen, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { RoleLabels } from '../constants/auth.js';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { Button } from '../components/ui/button.jsx';

export function RoleLayout({ role }) {
  const { account, signOut } = useAuth();
  const navigate = useNavigate();
  const label = RoleLabels[role];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            to={`/${role.toLowerCase().replace('_', '-')}`}
            className="flex items-center gap-2 font-semibold"
          >
            <BookOpen className="h-5 w-5 text-cyan-400" />
            AppEnglish
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:block">
              {account?.email}
            </span>
            <Button
              className="flex items-center gap-2 bg-slate-800 text-slate-100"
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
              `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-cyan-500 font-medium text-slate-950' : 'text-slate-300 hover:bg-slate-900'}`
            }
            to={`/${role.toLowerCase().replace('_', '-')}`}
          >
            Dashboard
          </NavLink>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

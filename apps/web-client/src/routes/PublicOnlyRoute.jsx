import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { dashboardPathForRole } from '../features/auth/flow/auth-flow.js';

export function PublicOnlyRoute() {
  const { status, account } = useAuth();
  if (status === 'loading')
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-300">
        Checking your session…
      </main>
    );
  if (account)
    return <Navigate to={dashboardPathForRole(account.role)} replace />;
  return <Outlet />;
}

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { dashboardPathForRole } from '../features/auth/flow/auth-flow.js';
import { LoadingScreen } from '../components/ui/loading-screen.jsx';

export function PublicOnlyRoute() {
  const { status, account } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (account) return <Navigate to={dashboardPathForRole(account.role)} replace />;
  return <Outlet />;
}
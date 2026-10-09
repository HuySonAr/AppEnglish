import { Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { UnauthorizedPage } from '../features/auth/pages/UnauthorizedPage.jsx';

export function RoleRoute({ allowedRole }) {
  const { account } = useAuth();
  if (account?.role !== allowedRole) return <UnauthorizedPage />;
  return <Outlet />;
}

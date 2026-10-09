import { Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext.jsx';
import { accountHasRole } from '../features/auth/flow/auth-flow.js';
import { UnauthorizedPage } from '../features/auth/pages/UnauthorizedPage.jsx';

export function RoleRoute({ allowedRole }) {
  const { account } = useAuth();
  if (!accountHasRole(account, allowedRole)) return <UnauthorizedPage />;
  return <Outlet />;
}

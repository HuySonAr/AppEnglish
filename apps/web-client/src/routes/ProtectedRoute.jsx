import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext.jsx';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingScreen />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

function LoadingScreen() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-300">Checking your session…</main>;
}

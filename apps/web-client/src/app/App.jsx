import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { HealthPage } from '../features/learning/pages/HealthPage.jsx';
import { AuthPage } from '../features/auth/pages/AuthPage.jsx';
import { AppPage } from '../features/auth/pages/AppPage.jsx';
import {
  getCurrentUser,
  logoutAccount,
} from '../features/auth/api/auth-api.js';

export default function App() {
  const [session, setSession] = useState({ loading: true, account: null });
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentUser()
      .then((result) => setSession({ loading: false, account: result.account }))
      .catch(() => setSession({ loading: false, account: null }));
  }, []);

  async function logout() {
    await logoutAccount().catch(() => {});
    setSession({ loading: false, account: null });
    navigate('/auth');
  }

  if (session.loading)
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-slate-300">
        Checking session…
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          AppEnglish
        </Link>
        <span className="text-sm text-slate-400">Reading & Listening</span>
      </nav>
      <Routes>
        <Route
          path="/auth"
          element={
            session.account ? (
              <Navigate to="/app" replace />
            ) : (
              <AuthPage
                onAuthenticated={(result) => {
                  setSession({ loading: false, account: result.account });
                  navigate('/app');
                }}
              />
            )
          }
        />
        <Route
          path="/app"
          element={
            session.account ? (
              <AppPage account={session.account} onLogout={logout} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route path="/" element={<HealthPage />} />
        <Route
          path="*"
          element={<Navigate to={session.account ? '/app' : '/auth'} replace />}
        />
      </Routes>
    </main>
  );
}

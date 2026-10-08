import { Routes, Route, Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { HealthPage } from '../features/learning/pages/HealthPage.jsx';
import { AuthPage } from '../features/auth/pages/AuthPage.jsx';

export default function App() {
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
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<HealthPage />} />
      </Routes>
    </main>
  );
}

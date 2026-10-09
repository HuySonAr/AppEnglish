import { Link, Outlet } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export function AuthLayout() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center px-6 py-6">
        <Link to="/login" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-cyan-400" />
          AppEnglish
        </Link>
      </header>
      <Outlet />
    </main>
  );
}

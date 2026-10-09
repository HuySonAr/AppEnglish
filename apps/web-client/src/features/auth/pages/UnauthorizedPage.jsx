import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return <section className="mx-auto max-w-xl px-6 py-20 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-rose-300">403</p><h1 className="mt-3 text-4xl font-bold">Access denied</h1><p className="mt-4 text-slate-400">Your account does not have permission to view this area.</p><Link className="mt-8 inline-block text-cyan-300 underline" to="/">Return to your dashboard</Link></section>;
}

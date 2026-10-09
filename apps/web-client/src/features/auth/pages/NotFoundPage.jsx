import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <section className="mx-auto max-w-xl px-6 py-20 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-slate-400">404</p><h1 className="mt-3 text-4xl font-bold">Page not found</h1><Link className="mt-8 inline-block text-cyan-300 underline" to="/">Return home</Link></section>;
}

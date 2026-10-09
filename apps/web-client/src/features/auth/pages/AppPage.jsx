export function AppPage({ account, onLogout }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-cyan-400">Authenticated area</p>
      <h1 className="mt-3 text-4xl font-bold">Welcome to AppEnglish</h1>
      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-5">
        <p>Email: <strong>{account.email}</strong></p>
        <p className="mt-2">Role: <strong>{account.role}</strong></p>
      </div>
      <button className="mt-6 rounded-md border border-slate-600 px-4 py-2" onClick={onLogout}>Log out</button>
    </section>
  );
}

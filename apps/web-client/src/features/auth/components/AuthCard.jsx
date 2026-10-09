export function AuthCard({
  eyebrow = 'AppEnglish',
  title,
  description,
  children,
}) {
  return (
    <section className="mx-auto w-full max-w-md px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-cyan-400">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-bold">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      )}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function AuthLink({ children, ...props }) {
  return (
    <a
      className="text-sm text-cyan-300 underline underline-offset-4"
      {...props}
    >
      {children}
    </a>
  );
}

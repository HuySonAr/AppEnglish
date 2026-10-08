export function Button({ className = '', children, ...props }) {
  return <button className={`rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 ${className}`} {...props}>{children}</button>;
}

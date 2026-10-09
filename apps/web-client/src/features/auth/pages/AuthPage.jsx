import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { loginAccount, registerAccount } from '../api/auth-api.js';

export function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const form = useForm({ resolver: zodResolver(authFormSchema), defaultValues: { email: '', password: '' } });
  const mutation = useMutation({
    mutationFn: mode === 'login' ? loginAccount : registerAccount,
    onSuccess: onAuthenticated
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));
  const serverMessage = mutation.error?.response?.data?.message || 'Authentication failed. Please try again.';

  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <p className="mt-2 text-sm text-slate-400">
        {mode === 'login' ? 'Use your AppEnglish credentials.' : 'New public accounts are Student accounts.'}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm">Email
          <input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="email" {...form.register('email')} />
          <span className="mt-1 block text-xs text-rose-300">{form.formState.errors.email?.message}</span>
        </label>
        <label className="block text-sm">Password
          <input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="password" {...form.register('password')} />
          <span className="mt-1 block text-xs text-rose-300">{form.formState.errors.password?.message}</span>
        </label>
        <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Submitting…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>
      {mutation.isError && <p className="mt-4 text-sm text-rose-300">{serverMessage}</p>}
      <button className="mt-6 text-sm text-cyan-300 underline" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); mutation.reset(); }}>
        {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
      </button>
    </section>
  );
}

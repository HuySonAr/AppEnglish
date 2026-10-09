import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { forgotPassword, loginAccount, registerAccount, resendVerification, resetPassword, verifyEmail } from '../api/auth-api.js';
import { ResponseCode } from '@appenglish/auth-contracts';

export function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const forgotMutation = useMutation({ mutationFn: forgotPassword, onSuccess: (_, values) => { setPendingEmail(values.email); setMode('reset'); } });
  const resetMutation = useMutation({ mutationFn: resetPassword, onSuccess: () => setMode('login') });
  const form = useForm({ resolver: zodResolver(authFormSchema), defaultValues: { email: '', password: '' } });
  const mutation = useMutation({
    mutationFn: (values) => mode === 'login' ? loginAccount(values) : registerAccount(values),
    onSuccess: (result, values) => {
      if (result.code === ResponseCode.ADDITIONAL) { setPendingEmail(values.email); setMode('verify'); }
      else onAuthenticated(result.data || result);
    },
  });
  const verifyMutation = useMutation({
    mutationFn: verifyEmail,
    onSuccess: (result) => onAuthenticated(result.data || result)
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));
  if (mode === 'verify') {
    return <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm text-slate-400">Enter the 6-digit code sent to {pendingEmail}.</p>
      <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); verifyMutation.mutate(Object.fromEntries(new FormData(event.currentTarget))); }}>
        <input name="email" type="hidden" value={pendingEmail} />
        <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" name="otp" inputMode="numeric" pattern="\d{6}" required />
        <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" type="submit">Verify email</button>
      </form>
      <button className="mt-6 text-sm text-cyan-300 underline" onClick={() => resendVerification({ email: pendingEmail })}>Resend code</button>
      {verifyMutation.isError && <p className="mt-4 text-sm text-rose-300">The verification code is invalid or expired.</p>}
    </section>;
  }
  if (mode === 'forgot') {
    return <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Forgot password</h1>
      <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); forgotMutation.mutate(Object.fromEntries(new FormData(event.currentTarget))); }}>
        <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" name="email" type="email" placeholder="Email" required />
        <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" type="submit">Send reset code</button>
      </form>
      <button className="mt-6 text-sm text-cyan-300 underline" onClick={() => setMode('login')}>Back to sign in</button>
    </section>;
  }
  if (mode === 'reset') {
    return <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Reset password</h1>
      <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); resetMutation.mutate({ ...Object.fromEntries(new FormData(event.currentTarget)), email: pendingEmail }); }}>
        <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" name="otp" inputMode="numeric" pattern="\d{6}" placeholder="6-digit code" required />
        <input className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" name="password" type="password" minLength="8" placeholder="New password" required />
        <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" type="submit">Reset password</button>
      </form>
      {resetMutation.isError && <p className="mt-4 text-sm text-rose-300">The reset code is invalid or expired.</p>}
    </section>;
  }
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
      {mode === 'login' && <button className="mt-3 block text-sm text-cyan-300 underline" type="button" onClick={() => { mutation.reset(); setMode('forgot'); }}>Forgot password?</button>}
    </section>
  );
}

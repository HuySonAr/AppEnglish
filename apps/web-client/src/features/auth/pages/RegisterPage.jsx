import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResponseCode } from '@appenglish/auth-contracts';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { registerAccount } from '../api/auth-api.js';
import { AuthCard } from '../components/AuthCard.jsx';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { registerOutcome } from '../flow/auth-flow.js';
import { useToast } from '../../../components/shared/ToastProvider.jsx';

export function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [existingEmail, setExistingEmail] = useState('');
  const form = useForm({ resolver: zodResolver(authFormSchema), defaultValues: { email: '', password: '' } });
  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await registerAccount(values);
      if (registerOutcome(result) !== 'verify-email') {
        toast('Something went wrong. Please try again.', 'error');
        return;
      }
      setExistingEmail('');
      toast('Check your email for the verification code. You can request a new code if it has not arrived.', 'success');
      navigate('/verify-email', { state: { email: values.email } });
    } catch (error) {
      if (errorCode(error) === ResponseCode.AUTH_EMAIL_ALREADY_REGISTERED) {
        // The email belongs to an already verified account: point the user at
        // sign-in or password reset instead of a dead end.
        setExistingEmail(values.email);
      }
      toast(getApiErrorMessage(error), 'error');
    }
  });
  return <AuthCard title="Create your account" description="Public registration creates a Student account.">
    {existingEmail ? (
      <div className="mb-5 rounded-md border border-amber-500/40 bg-slate-900 p-4 text-sm text-slate-200" role="alert">
        <p>This email is already registered and verified. Sign in, or reset the password if you have forgotten it.</p>
        <p className="mt-3 flex gap-4">
          <Link className="text-cyan-300 underline" to="/login" state={{ email: existingEmail }}>Sign in</Link>
          <Link className="text-cyan-300 underline" to="/forgot-password" state={{ email: existingEmail }}>Reset password</Link>
        </p>
      </div>
    ) : null}
    <form className="space-y-5" onSubmit={submit}>
      <label className="block text-sm">Email<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="email" {...form.register('email')} />{form.formState.errors.email && <span className="mt-1 block text-xs text-rose-300">{form.formState.errors.email.message}</span>}</label>
      <label className="block text-sm">Password<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="password" {...form.register('password')} />{form.formState.errors.password && <span className="mt-1 block text-xs text-rose-300">{form.formState.errors.password.message}</span>}</label>
      <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Creating account…' : 'Register'}</button>
    </form>
    <p className="mt-6 text-sm text-slate-400">Already registered? <Link className="text-cyan-300 underline" to="/login" state={{ email: existingEmail || undefined }}>Sign in</Link></p>
  </AuthCard>;
}

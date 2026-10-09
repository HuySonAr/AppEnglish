import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { registerAccount } from '../api/auth-api.js';
import { AuthCard } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../components/shared/ToastProvider.jsx';

export function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const form = useForm({ resolver: zodResolver(authFormSchema), defaultValues: { email: '', password: '' } });
  const submit = form.handleSubmit(async (values) => {
    try {
      await registerAccount(values);
      toast('Account created. Check your email for the verification code.', 'success');
      navigate('/verify-email', { state: { email: values.email } });
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
    }
  });
  return <AuthCard title="Create your account" description="Public registration creates a Student account.">
    <form className="space-y-5" onSubmit={submit}>
      <label className="block text-sm">Email<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="email" {...form.register('email')} />{form.formState.errors.email && <span className="mt-1 block text-xs text-rose-300">{form.formState.errors.email.message}</span>}</label>
      <label className="block text-sm">Password<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="password" {...form.register('password')} />{form.formState.errors.password && <span className="mt-1 block text-xs text-rose-300">{form.formState.errors.password.message}</span>}</label>
      <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Creating account…' : 'Register'}</button>
    </form>
    <p className="mt-6 text-sm text-slate-400">Already registered? <Link className="text-cyan-300 underline" to="/login">Sign in</Link></p>
  </AuthCard>;
}

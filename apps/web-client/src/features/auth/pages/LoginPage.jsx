import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { AuthCard } from '../components/AuthCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { dashboardPathForRole } from '../flow/auth-flow.js';
import { useToast } from '../../../components/shared/ToastProvider.jsx';

export function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({
    resolver: zodResolver(authFormSchema),
    defaultValues: { email: '', password: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      const account = await signIn(values);
      const target =
        location.state?.from?.pathname ||
        dashboardPathForRole(account.role);
      toast('Signed in successfully.', 'success');
      navigate(target, { replace: true });
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
    }
  });

  return (
    <AuthCard title="Sign in" description="Use your AppEnglish credentials.">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm">
          Email
          <input
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="email"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <span className="mt-1 block text-xs text-rose-300">
              {form.formState.errors.email.message}
            </span>
          )}
        </label>
        <label className="block text-sm">
          Password
          <input
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="password"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <span className="mt-1 block text-xs text-rose-300">
              {form.formState.errors.password.message}
            </span>
          )}
        </label>
        <button
          className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-6 flex justify-between gap-4">
        <Link className="text-sm text-cyan-300 underline" to="/register">
          Create account
        </Link>
        <Link className="text-sm text-cyan-300 underline" to="/forgot-password">
          Forgot password?
        </Link>
      </div>
    </AuthCard>
  );
}

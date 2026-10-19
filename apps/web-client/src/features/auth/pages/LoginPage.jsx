import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorReason, getApiErrorMessage } from '../../../lib/api/response.js';
import {
  dashboardPathForRole,
  isVerificationRequiredError,
} from '../flow/auth-flow.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';
import { Label } from '../../../components/ui/label.jsx';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({
    resolver: zodResolver(authFormSchema),
    defaultValues: { email: location.state?.email || '', password: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      const account = await signIn(values);
      const target =
        location.state?.from?.pathname || dashboardPathForRole(account.role);
      notify({ title: 'Signed in successfully.' });
      navigate(target, { replace: true });
    } catch (error) {
      if (isVerificationRequiredError(error)) {
        notify({ title: 'Verify your email before signing in.', variant: 'info' });
        navigate('/verify-email', { state: { email: values.email } });
        return;
      }
      const reason = errorReason(error);
      notify({
        title: 'Sign in failed',
        description: reason ? `${getApiErrorMessage(error)} Reason: ${reason}` : getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  });

  return (
    <AuthCard title="Sign in" description="Use your AppEnglish credentials.">
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...form.register('email')}
            disabled={form.formState.isSubmitting}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...form.register('password')}
            disabled={form.formState.isSubmitting}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <Button loading={form.formState.isSubmitting}
          className="w-full"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div className="mt-6 flex justify-between gap-4">
        <AuthLink to="/register">Create account</AuthLink>
        <AuthLink to="/forgot-password">Forgot password?</AuthLink>
      </div>
    </AuthCard>
  );
}

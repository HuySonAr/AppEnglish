import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import {
  dashboardPathForRole,
  isVerificationRequiredError,
} from '../flow/auth-flow.js';
import { useToast } from '../../../hooks/use-toast.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Label } from '../../../components/ui/label.jsx';

export function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
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
      toast({ title: 'Signed in successfully.' });
      navigate(target, { replace: true });
    } catch (error) {
      if (isVerificationRequiredError(error)) {
        toast({ title: 'Verify your email before signing in.' });
        navigate('/verify-email', { state: { email: values.email } });
        return;
      }
      toast({
        title: 'Sign in failed',
        description: getApiErrorMessage(error),
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
          <Input
            id="password"
            type="password"
            {...form.register('password')}
            disabled={form.formState.isSubmitting}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <Button
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

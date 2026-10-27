import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormSchema } from '../schemas/auth-schemas.js';
import { AuthCard, AuthFields, AuthLink, FieldError, FieldLabel, authButton, authInput } from '../components/AuthCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorReason, getApiErrorMessage } from '../../../lib/api/response.js';
import { dashboardPathForRole, focusOnEnter, isVerificationRequiredError } from '../flow/auth-flow.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: location.state?.email || '', password: '' },
  });
  const pending = form.formState.isSubmitting;
  const submit = form.handleSubmit(async (values) => {
    try {
      const account = await signIn(values);
      notify({ title: 'Signed in successfully.' });
      navigate(location.state?.from?.pathname || dashboardPathForRole(account.role), { replace: true });
    } catch (error) {
      if (isVerificationRequiredError(error)) {
        notify({ title: 'Verify your email before signing in.', variant: 'info' });
        navigate('/verify-email', { state: { email: values.email } });
        return;
      }
      const reason = errorReason(error);
      notify({ title: 'Sign in failed', description: reason ? `${getApiErrorMessage(error)} Reason: ${reason}` : getApiErrorMessage(error), variant: 'destructive' });
    }
  });

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to keep learning."
      footer={
        <>
          New to AppEnglish? <AuthLink to="/register">Create an account</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <AuthFields>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={authInput} {...form.register('email')} onKeyDown={focusOnEnter('password')} disabled={pending} />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <FieldLabel
              htmlFor="password"
              aside={
                <AuthLink to="/forgot-password" state={{ email: form.watch('email') || undefined }} className="text-xs font-normal text-muted-foreground no-underline hover:underline">
                  Forgot password?
                </AuthLink>
              }
            >
              Password
            </FieldLabel>
            <PasswordInput id="password" autoComplete="current-password" placeholder="Your password" className={authInput} {...form.register('password')} disabled={pending} />
            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </div>
          <Button loading={pending} className={`${authButton} mt-2`} disabled={pending} type="submit">
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </AuthFields>
      </form>
    </AuthCard>
  );
}

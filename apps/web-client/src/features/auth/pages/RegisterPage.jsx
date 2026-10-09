import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResponseCode } from '@appenglish/auth-contracts';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { registerAccount } from '../api/auth-api.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { registerOutcome } from '../flow/auth-flow.js';
import { useToast } from '../../../hooks/use-toast.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Label } from '../../../components/ui/label.jsx';

export function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [existingEmail, setExistingEmail] = useState('');
  const form = useForm({
    resolver: zodResolver(authFormSchema),
    defaultValues: { email: '', password: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await registerAccount(values);
      if (registerOutcome(result) !== 'verify-email') {
        toast({
          title: 'Registration failed',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
        return;
      }
      setExistingEmail('');
      toast({
        title: 'Check your email',
        description: 'A verification code was sent.',
      });
      navigate('/verify-email', { state: { email: values.email } });
    } catch (error) {
      if (errorCode(error) === ResponseCode.AUTH_EMAIL_ALREADY_REGISTERED) {
        setExistingEmail(values.email);
      }
      toast({
        title: 'Registration failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  });
  return (
    <AuthCard
      title="Create your account"
      description="Public registration creates a Student account."
    >
      {existingEmail ? (
        <div
          className="mb-5 rounded-md border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-400"
          role="alert"
        >
          <p>
            This email is already registered and verified. Sign in, or reset the
            password if you have forgotten it.
          </p>
          <p className="mt-3 flex gap-4">
            <AuthLink
              to="/login"
              state={{ email: existingEmail }}
            >
              Sign in
            </AuthLink>
            <AuthLink
              to="/forgot-password"
              state={{ email: existingEmail }}
            >
              Reset password
            </AuthLink>
          </p>
        </div>
      ) : null}
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
          {form.formState.isSubmitting ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{' '}
        <AuthLink
          to="/login"
          state={{ email: existingEmail || undefined }}
        >
          Sign in
        </AuthLink>
      </p>
    </AuthCard>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResponseCode } from '@appenglish/auth-contracts';
import { authFormSchema } from '../schemas/auth-schemas.js';
import { registerAccount } from '../api/auth-api.js';
import { AuthCard, AuthFields, AuthLink, FieldError, FieldLabel, authButton, authInput } from '../components/AuthCard.jsx';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { registerOutcome } from '../flow/auth-flow.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';

export function RegisterPage() {
  const navigate = useNavigate();
  const [existingEmail, setExistingEmail] = useState('');
  const form = useForm({ resolver: zodResolver(authFormSchema), defaultValues: { email: '', password: '' } });
  const pending = form.formState.isSubmitting;
  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await registerAccount(values);
      if (registerOutcome(result) !== 'verify-email') {
        notify({ title: 'Registration failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
        return;
      }
      setExistingEmail('');
      notify({ title: 'Check your email', description: 'A verification code was sent.' });
      navigate('/verify-email', { state: { email: values.email } });
    } catch (error) {
      if (errorCode(error) === ResponseCode.AUTH_EMAIL_ALREADY_REGISTERED) setExistingEmail(values.email);
      notify({ title: 'Registration failed', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  });

  return (
    <AuthCard
      title="Create an account"
      description="Sign up and start learning for free."
      footer={
        <>
          Have an account?{' '}
          <AuthLink to="/login" state={{ email: existingEmail || undefined }}>
            Sign in
          </AuthLink>
        </>
      }
    >
      {existingEmail ? (
        <div className="auth-in mb-5 rounded-3xl border border-warning/40 bg-warning/10 px-5 py-4 text-sm" role="alert">
          <p>This email already has an account.</p>
          <p className="mt-2 flex gap-4">
            <AuthLink to="/login" state={{ email: existingEmail }}>
              Sign in
            </AuthLink>
            <AuthLink to="/forgot-password" state={{ email: existingEmail }}>
              Reset password
            </AuthLink>
          </p>
        </div>
      ) : null}
      <form onSubmit={submit} noValidate>
        <AuthFields>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={authInput} {...form.register('email')} disabled={pending} />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput id="password" autoComplete="new-password" placeholder="At least 8 characters" className={authInput} {...form.register('password')} disabled={pending} />
            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </div>
          <Button loading={pending} className={`${authButton} mt-2`} disabled={pending} type="submit">
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
        </AuthFields>
      </form>
    </AuthCard>
  );
}

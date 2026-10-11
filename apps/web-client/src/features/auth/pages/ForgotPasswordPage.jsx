import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth-api.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Label } from '../../../components/ui/label.jsx';

export function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await forgotPassword({ email });
      notify({
        title: 'Reset code requested',
        description:
          'If the account can receive mail, a reset code has been sent.',
      });
      navigate('/reset-password', {
        state: {
          email,
          resendAfterSeconds: result?.data?.resendAfterSeconds,
        },
      });
    } catch (error) {
      notify({
        title: 'Request failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthCard
      title="Forgot password"
      description="Request a password reset code without revealing account details."
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={pending}
          />
        </div>
        <Button
          className="w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Sending…' : 'Send reset code'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <AuthLink to="/login">Back to sign in</AuthLink>
      </p>
    </AuthCard>
  );
}
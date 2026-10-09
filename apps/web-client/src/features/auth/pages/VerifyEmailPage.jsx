import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NextAction } from '@appenglish/auth-contracts';
import { verifyEmail, resendVerification } from '../api/auth-api.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import {
  dashboardPathForRole,
  verifyOtpAndRestoreSession,
} from '../flow/auth-flow.js';
import { useToast } from '../../../hooks/use-toast.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Label } from '../../../components/ui/label.jsx';

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { restoreSession } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(value - 1, 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const { alreadyVerified, account, restoredAccount } =
        await verifyOtpAndRestoreSession({
          verifyEmail: () => verifyEmail({ email, otp }),
          restoreSession,
        });
      if (alreadyVerified) {
        toast({
          title: 'Email already verified',
          description: 'Please sign in.',
        });
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      if (!restoredAccount) {
        toast({
          title: 'Session could not be loaded',
          description: `Email verified for ${account.email}. Please sign in.`,
          variant: 'destructive',
        });
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      toast({ title: 'Email verified', description: 'You are signed in.' });
      navigate(dashboardPathForRole(restoredAccount.role), { replace: true });
    } catch (error) {
      toast({
        title: 'Verification failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setResendPending(true);
    try {
      const result = await resendVerification({ email });
      if (result?.data?.nextAction === NextAction.LOGIN) {
        toast({
          title: 'Email already verified',
          description: 'Please sign in.',
        });
        return;
      }
      setCooldown(result?.data?.resendAfterSeconds || 60);
      toast({ title: 'Verification code sent' });
    } catch (error) {
      toast({
        title: 'Resend failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setResendPending(false);
    }
  }

  return (
    <AuthCard
      title="Verify your email"
      description="Enter the 6-digit code sent to your email address."
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
        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength="6"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            required
            disabled={pending}
            className="tracking-[0.3em]"
          />
        </div>
        <Button
          className="w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Verifying…' : 'Verify email'}
        </Button>
      </form>
      <Button
        variant="ghost"
        className="mt-5 w-full"
        disabled={resendPending || cooldown > 0 || !email}
        onClick={resend}
        type="button"
      >
        {resendPending
          ? 'Sending…'
          : cooldown
            ? `Resend in ${cooldown}s`
            : 'Resend code'}
      </Button>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <AuthLink to="/login">Back to sign in</AuthLink>
      </p>
    </AuthCard>
  );
}
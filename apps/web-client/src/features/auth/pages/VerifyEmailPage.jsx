import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NextAction } from '@appenglish/auth-contracts';
import { verifyEmail, resendVerification } from '../api/auth-api.js';
import { AuthCard, AuthLink, FieldLabel, authButton } from '../components/AuthCard.jsx';
import { CodeSentTo } from '../components/CodeSentTo.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { dashboardPathForRole, verifyOtpAndRestoreSession } from '../flow/auth-flow.js';
import { notify } from '../../../lib/notify.js';
import { isComplete } from '../../../lib/otp.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { OtpInput } from '../../../components/shared/OtpInput.jsx';

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { restoreSession } = useAuth();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function verify(code) {
    if (busy.current || !email || !isComplete(code)) return;
    busy.current = true;
    setPending(true);
    try {
      const { alreadyVerified, account, restoredAccount } = await verifyOtpAndRestoreSession({ verifyEmail: () => verifyEmail({ email, otp: code }), restoreSession });
      if (alreadyVerified) {
        notify({ title: 'Email already verified', variant: 'info', description: 'Please sign in.' });
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      if (!restoredAccount) {
        notify({ title: 'Session could not be loaded', description: `Email verified for ${account.email}. Please sign in.`, variant: 'destructive' });
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      notify({ title: 'Email verified', description: 'You are signed in.' });
      navigate(dashboardPathForRole(restoredAccount.role), { replace: true });
    } catch (error) {
      setInvalid(true);
      notify({ title: 'Verification failed', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function resend() {
    setResendPending(true);
    try {
      const result = await resendVerification({ email });
      if (result?.data?.nextAction === NextAction.LOGIN) {
        notify({ title: 'Email already verified', variant: 'info', description: 'Please sign in.' });
        return;
      }
      setCooldown(result?.data?.resendAfterSeconds || 60);
      setOtp('');
      setInvalid(false);
      notify({ title: 'Verification code sent' });
    } catch (error) {
      notify({ title: 'Resend failed', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setResendPending(false);
    }
  }

  return (
    <AuthCard title="Check your inbox" description="Enter the 6-digit code we sent you." footer={<AuthLink to="/login">Back to sign in</AuthLink>}>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          verify(otp);
        }}
      >
        <CodeSentTo email={email} onEmail={setEmail} disabled={pending} />
        <div className="space-y-2">
          <FieldLabel htmlFor="otp">Verification code</FieldLabel>
          <OtpInput
            id="otp"
            value={otp}
            onChange={(next) => {
              setOtp(next);
              setInvalid(false);
            }}
            onComplete={verify}
            invalid={invalid}
            disabled={pending}
            autoFocus={Boolean(email)}
          />
        </div>
        <Button loading={pending} className={authButton} disabled={pending || !email || !isComplete(otp)} type="submit">
          {pending ? 'Verifying…' : 'Verify email'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{' '}
        <button type="button" className="font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline" disabled={resendPending || cooldown > 0 || !email} onClick={resend}>
          {resendPending ? 'Sending…' : cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </p>
    </AuthCard>
  );
}

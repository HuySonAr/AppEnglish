import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NextAction } from '@appenglish/auth-contracts';
import { verifyEmail, resendVerification } from '../api/auth-api.js';
import { AuthCard } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import {
  dashboardPathForRole,
  verifyOtpAndRestoreSession,
} from '../flow/auth-flow.js';
import { useToast } from '../../../components/shared/ToastProvider.jsx';
import { useAuth } from '../context/AuthContext.jsx';

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
      const { account, restoredAccount } = await verifyOtpAndRestoreSession({
        verifyEmail: () => verifyEmail({ email, otp }),
        restoreSession,
      });
      if (!restoredAccount) {
        toast(
          `Email verified for ${account.email}, but the session could not be loaded. Please sign in.`,
          'error',
        );
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      toast('Email verified. You are signed in.', 'success');
      navigate(dashboardPathForRole(restoredAccount.role), { replace: true });
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setResendPending(true);
    try {
      const result = await resendVerification({ email });
      if (result?.data?.nextAction === NextAction.LOGIN) {
        toast('This email is already verified. Please sign in.', 'success');
        return;
      }
      setCooldown(result?.data?.resendAfterSeconds || 60);
      toast('A new verification code was sent.', 'success');
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
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
        <label className="block text-sm">
          Email
          <input
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Verification code
          <input
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 tracking-[0.3em]"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength="6"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            required
          />
        </label>
        <button
          className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Verifying…' : 'Verify email'}
        </button>
      </form>
      <button
        className="mt-5 text-sm text-cyan-300 underline disabled:opacity-50"
        disabled={resendPending || cooldown > 0 || !email}
        onClick={resend}
        type="button"
      >
        {resendPending
          ? 'Sending…'
          : cooldown
            ? `Resend in ${cooldown}s`
            : 'Resend code'}
      </button>
      <p className="mt-5 text-sm text-slate-400">
        <Link className="text-cyan-300 underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/auth-api.js';
import { AuthCard, AuthLink, FieldLabel, authButton, authInput } from '../components/AuthCard.jsx';
import { CodeSentTo } from '../components/CodeSentTo.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { isComplete } from '../../../lib/otp.js';
import { Button } from '../../../components/ui/button.jsx';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';
import { OtpInput } from '../../../components/shared/OtpInput.jsx';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const ready = email && isComplete(otp) && password.length >= 8;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    try {
      await resetPassword({ email, otp, password });
      notify({ title: 'Password reset', description: 'Please sign in.' });
      navigate('/login', { replace: true, state: { email } });
    } catch (error) {
      notify({ title: 'Password reset failed', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Enter the code from your email and a new password."
      footer={
        <>
          No code?{' '}
          <AuthLink to="/forgot-password" state={{ email: email || undefined }}>
            Send a new one
          </AuthLink>
          <span className="mx-2">·</span>
          <AuthLink to="/login">Back to sign in</AuthLink>
        </>
      }
    >
      <form className="space-y-6" onSubmit={submit}>
        <CodeSentTo email={email} onEmail={setEmail} disabled={pending} />
        <div className="space-y-2">
          <FieldLabel htmlFor="otp">Reset code</FieldLabel>
          <OtpInput id="otp" label="Reset code" value={otp} onChange={setOtp} disabled={pending} autoFocus={Boolean(email)} />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput id="password" autoComplete="new-password" minLength="8" className={authInput} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button loading={pending} className={authButton} disabled={pending || !ready} type="submit">
          {pending ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthCard>
  );
}

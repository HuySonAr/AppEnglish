import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/auth-api.js';
import { AuthCard, AuthLink, FieldLabel, NewPasswordFields, authButton } from '../components/AuthCard.jsx';
import { PASSWORD_MIN } from '../schemas/auth-schemas.js';
import { CodeSentTo } from '../components/CodeSentTo.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { isComplete } from '../../../lib/otp.js';
import { Button } from '../../../components/ui/button.jsx';
import { OtpInput } from '../../../components/shared/OtpInput.jsx';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const ready = email && isComplete(otp) && password.length >= PASSWORD_MIN && confirm === password;

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
      className="max-w-md"
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
      <form className="space-y-5 short:space-y-4" onSubmit={submit}>
        <CodeSentTo email={email} onEmail={setEmail} disabled={pending} />
        <div className="space-y-2">
          <FieldLabel htmlFor="otp">Reset code</FieldLabel>
          <OtpInput id="otp" label="Reset code" value={otp} onChange={setOtp} disabled={pending} autoFocus={Boolean(email)} />
        </div>
        <NewPasswordFields
          min={PASSWORD_MIN}
          label="New password"
          password={password}
          confirm={confirm}
          passwordProps={{ value: password, onChange: (event) => setPassword(event.target.value), minLength: PASSWORD_MIN, required: true, disabled: pending }}
          confirmProps={{ value: confirm, onChange: (event) => setConfirm(event.target.value), required: true, disabled: pending }}
        />
        <Button loading={pending} className={authButton} disabled={pending || !ready} type="submit">
          {pending ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthCard>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvite } from '../api/auth-api.js';
import { AuthCard, AuthLink, FieldLabel, NewPasswordFields, authButton } from '../components/AuthCard.jsx';
import { PASSWORD_MIN } from '../schemas/auth-schemas.js';
import { CodeSentTo } from '../components/CodeSentTo.jsx';
import { dashboardPathForRole, verifyOtpAndRestoreSession } from '../flow/auth-flow.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { isComplete } from '../../../lib/otp.js';
import { Button } from '../../../components/ui/button.jsx';
import { OtpInput } from '../../../components/shared/OtpInput.jsx';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { restoreSession } = useAuth();
  const [email, setEmail] = useState(params.get('email') || '');
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
      const { alreadyVerified, restoredAccount } = await verifyOtpAndRestoreSession({ verifyEmail: () => acceptInvite({ email, otp, password }), restoreSession });
      if (alreadyVerified) {
        notify({ title: 'Invitation already accepted', variant: 'info', description: 'Please sign in with your password.' });
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      if (!restoredAccount) {
        notify({ title: 'Session could not be loaded', description: 'Your password is set. Please sign in.', variant: 'destructive' });
        navigate('/login', { replace: true, state: { email } });
        return;
      }
      notify({ title: 'Welcome to AppEnglish', description: 'Your password is set and you are signed in.' });
      navigate(dashboardPathForRole(restoredAccount.role), { replace: true });
    } catch (error) {
      notify({ title: 'Could not accept the invitation', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      className="max-w-md"
      title="Join AppEnglish"
      description="Enter the code from your invitation and choose a password."
      footer={
        <>
          Code lost or expired? Ask your administrator for a new one. Already set up? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      <form className="space-y-5 short:space-y-4" onSubmit={submit}>
        <CodeSentTo email={email} onEmail={setEmail} disabled={pending} />
        <div className="space-y-2">
          <FieldLabel htmlFor="otp">Invitation code</FieldLabel>
          <OtpInput id="otp" label="Invitation code" value={otp} onChange={setOtp} disabled={pending} autoFocus={Boolean(email)} />
        </div>
        <NewPasswordFields
          min={PASSWORD_MIN}
          label="Choose a password"
          password={password}
          confirm={confirm}
          passwordProps={{ value: password, onChange: (event) => setPassword(event.target.value), minLength: PASSWORD_MIN, maxLength: 128, required: true, disabled: pending }}
          confirmProps={{ value: confirm, onChange: (event) => setConfirm(event.target.value), maxLength: 128, required: true, disabled: pending }}
        />
        <Button loading={pending} className={authButton} disabled={pending || !ready} type="submit">
          {pending ? 'Setting up…' : 'Set password and sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvite } from '../api/auth-api.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { dashboardPathForRole, verifyOtpAndRestoreSession } from '../flow/auth-flow.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Label } from '../../../components/ui/label.jsx';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { restoreSession } = useAuth();
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const { alreadyVerified, restoredAccount } = await verifyOtpAndRestoreSession({
        verifyEmail: () => acceptInvite({ email, otp, password }),
        restoreSession,
      });
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
    <AuthCard title="Accept your invitation" description="Enter the invitation code from the email and choose your password.">
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otp">Invitation code</Label>
          <Input id="otp" inputMode="numeric" pattern="\d{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value)} required disabled={pending} className="tracking-[0.3em]" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Choose a password</Label>
          <PasswordInput id="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" disabled={pending} />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button loading={pending} className="w-full" type="submit">
          {pending ? 'Setting up…' : 'Set password and sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Code expired or lost? Ask the administrator who invited you to send it again. Already set your password? <AuthLink to="/login">Sign in</AuthLink>
      </p>
    </AuthCard>
  );
}

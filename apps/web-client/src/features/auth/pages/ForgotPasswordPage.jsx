import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth-api.js';
import { AuthCard, AuthFields, AuthLink, FieldLabel, authButton, authInput } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';

export function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await forgotPassword({ email });
      notify({ title: 'Reset code requested', description: 'If the account can receive mail, a code has been sent.' });
      navigate('/reset-password', { state: { email, resendAfterSeconds: result?.data?.resendAfterSeconds } });
    } catch (error) {
      notify({ title: 'Request failed', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title="Forgot password?" description="We will email you a 6-digit reset code." footer={<AuthLink to="/login">Back to sign in</AuthLink>}>
      <form onSubmit={submit}>
        <AuthFields>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={authInput} value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} />
          </div>
          <Button loading={pending} className={`${authButton} mt-2`} disabled={pending} type="submit">
            {pending ? 'Sending…' : 'Send reset code'}
          </Button>
        </AuthFields>
      </form>
    </AuthCard>
  );
}

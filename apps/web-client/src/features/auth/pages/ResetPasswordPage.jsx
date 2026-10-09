import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/auth-api.js';
import { AuthCard, AuthLink } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../hooks/use-toast.js';
import { Button } from '../../../components/ui/button.jsx';
import { Input } from '../../../components/ui/input.jsx';
import { Label } from '../../../components/ui/label.jsx';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      await resetPassword({ email, otp, password });
      toast({ title: 'Password reset', description: 'Please sign in.' });
      navigate('/login', { replace: true });
    } catch (error) {
      toast({
        title: 'Password reset failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthCard
      title="Reset password"
      description="Enter the reset code and choose a new password."
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
          <Label htmlFor="otp">Reset code</Label>
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
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            minLength="8"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={pending}
          />
        </div>
        <Button
          className="w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <AuthLink to="/login">Back to sign in</AuthLink>
      </p>
    </AuthCard>
  );
}
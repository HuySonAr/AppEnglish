import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/auth-api.js';
import { AuthCard } from '../components/AuthCard.jsx';
import { getApiErrorMessage, responseData } from '../../../lib/api/response.js';
import { useToast } from '../../../components/shared/ToastProvider.jsx';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await forgotPassword({ email });
      toast(
        'If the account can receive mail, a reset code has been sent.',
        'success',
      );
      navigate('/reset-password', {
        state: {
          email,
          resendAfterSeconds: responseData(result).resendAfterSeconds,
        },
      });
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
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
        <button
          className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-400">
        <Link className="text-cyan-300 underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

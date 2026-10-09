import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/auth-api.js';
import { AuthCard } from '../components/AuthCard.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../components/shared/ToastProvider.jsx';

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
      toast('Password reset successfully. Please sign in.', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
    } finally {
      setPending(false);
    }
  }
  return <AuthCard title="Reset password" description="Enter the reset code and choose a new password.">
    <form className="space-y-5" onSubmit={submit}>
      <label className="block text-sm">Email<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="block text-sm">Reset code<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 tracking-[0.3em]" inputMode="numeric" pattern="\d{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value)} required /></label>
      <label className="block text-sm">New password<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2" type="password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <button className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-60" disabled={pending} type="submit">{pending ? 'Resetting…' : 'Reset password'}</button>
    </form>
    <p className="mt-6 text-sm text-slate-400"><Link className="text-cyan-300 underline" to="/login">Back to sign in</Link></p>
  </AuthCard>;
}

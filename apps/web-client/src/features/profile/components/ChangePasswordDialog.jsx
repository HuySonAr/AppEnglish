import { useEffect, useState } from 'react';
import { ArrowLeft, Check, KeyRound, ShieldCheck } from 'lucide-react';
import { ResponseCode } from '@appenglish/auth-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '../../../components/ui';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';
import { changePassword, verifyPassword } from '../../auth/api/auth-api.js';

const steps = [
  { id: 1, label: 'Confirm it is you', icon: ShieldCheck },
  { id: 2, label: 'New password', icon: KeyRound },
];

// The two steps as a bar: done, current, ahead.
function StepBar({ current }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${current} of ${steps.length}`}>
      {steps.map((step, index) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                done && 'border-success bg-success text-white',
                active && 'border-primary bg-primary text-primary-foreground',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : step.id}
            </span>
            <span className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
            {index < steps.length - 1 ? (
              <span className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className={cn('block h-full rounded-full bg-primary transition-all duration-500', done ? 'w-full' : 'w-0')} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// Password strength as a hint, not a rule: the backend only asks for 8+ characters.
function strengthOf(value) {
  if (!value) return null;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 1) return { level: 1, label: 'Weak', tone: 'bg-destructive' };
  if (score <= 3) return { level: 2, label: 'Fair', tone: 'bg-warning' };
  return { level: 3, label: 'Strong', tone: 'bg-success' };
}

// Opened on purpose from the profile (D113). Step 1 checks the current
// password with the server before anything else is asked; step 2 takes the
// new password twice. Other devices are signed out; this one gets fresh cookies.
export function ChangePasswordDialog({ open, onOpenChange, onChanged }) {
  const [step, setStep] = useState(1);
  const [current, setCurrent] = useState('');
  const [currentIssue, setCurrentIssue] = useState(null);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCurrent('');
    setCurrentIssue(null);
    setNext('');
    setConfirm('');
  }, [open]);

  async function confirmCurrent(event) {
    event.preventDefault();
    if (!current) return;
    setPending(true);
    setCurrentIssue(null);
    try {
      await verifyPassword({ currentPassword: current });
      setStep(2);
    } catch (error) {
      if (errorCode(error) === ResponseCode.AUTH_CURRENT_PASSWORD_INVALID) setCurrentIssue('That is not your current password. Try again.');
      else notify({ title: 'Could not check your password', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  const nextIssue =
    next && next.length < 8
      ? 'The new password needs at least 8 characters.'
      : next && next === current
        ? 'Choose a password different from the current one.'
        : confirm && next !== confirm
          ? 'The two new passwords do not match.'
          : null;
  const ready = next && confirm && !nextIssue;
  const strength = strengthOf(next);

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      await onChanged?.();
      notify({ title: 'Password changed', description: 'Your other devices were signed out.' });
      onOpenChange(false);
    } catch (error) {
      // The current password changed elsewhere in between: back to step 1.
      if (errorCode(error) === ResponseCode.AUTH_CURRENT_PASSWORD_INVALID) {
        setStep(1);
        setCurrentIssue('Your current password no longer matched. Enter it again.');
      } else notify({ title: 'Could not change your password', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>You stay signed in on this device; every other device is signed out.</DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <StepBar current={step} />
        </div>

        {step === 1 ? (
          <form onSubmit={confirmCurrent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                value={current}
                onChange={(event) => {
                  setCurrent(event.target.value);
                  setCurrentIssue(null);
                }}
                disabled={pending}
                aria-invalid={currentIssue ? 'true' : undefined}
                required
                autoFocus
              />
              {currentIssue ? (
                <p className="text-sm text-destructive" role="alert">
                  {currentIssue}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">We check it before asking for a new one.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={!current}>
                Continue
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput id="newPassword" autoComplete="new-password" minLength={8} value={next} onChange={(event) => setNext(event.target.value)} disabled={pending} required autoFocus />
              {strength ? (
                <div className="flex items-center gap-2" aria-live="polite">
                  <span className="flex flex-1 gap-1" aria-hidden="true">
                    {[1, 2, 3].map((level) => (
                      <span key={level} className={cn('h-1.5 flex-1 rounded-full transition-colors', level <= strength.level ? strength.tone : 'bg-muted')} />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground">{strength.label}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">At least 8 characters. Mixing letters, numbers and symbols makes it stronger.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Repeat new password</Label>
              <PasswordInput id="confirmPassword" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={pending} aria-invalid={confirm && next !== confirm ? 'true' : undefined} required />
              {nextIssue ? (
                <p className="text-sm text-destructive" role="alert">
                  {nextIssue}
                </p>
              ) : null}
            </div>
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="submit" loading={pending} disabled={!ready}>
                Change password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

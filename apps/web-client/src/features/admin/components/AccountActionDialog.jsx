import { useEffect, useState } from 'react';
import { AdminAccountAction } from '@appenglish/auth-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { adminAccountAction } from '../../auth/api/auth-api.js';

// What each one-off action says and does (D114).
export const actionCopy = Object.freeze({
  [AdminAccountAction.REVOKE_SESSIONS]: {
    title: 'Sign out of every device',
    description: 'Every session of this account ends now. The person signs in again with their password; nothing else changes.',
    confirm: 'Sign out everywhere',
    done: 'Signed out of every device',
    reason: 'optional',
  },
  [AdminAccountAction.SEND_PASSWORD_RESET]: {
    title: 'Send a password reset email',
    description: 'The person receives a six-digit code valid for five minutes and chooses a new password themselves. Nobody sees the password.',
    confirm: 'Send the email',
    done: 'Reset email sent',
    reason: 'none',
  },
  [AdminAccountAction.REMOVE_AVATAR]: {
    title: 'Remove the profile picture',
    description: 'The picture is deleted and the initial is shown instead. The person can upload another one.',
    confirm: 'Remove picture',
    done: 'Picture removed',
    reason: 'optional',
  },
  [AdminAccountAction.RESET_DISPLAY_NAME]: {
    title: 'Reset the display name',
    description: 'The name is cleared and the first part of the email is shown instead. The person can set a new one.',
    confirm: 'Reset name',
    done: 'Display name reset',
    reason: 'optional',
  },
});

// Confirms one action on an account, with an optional note for the audit trail.
export function AccountActionDialog({ account, action, onOpenChange, onDone }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const copy = action ? actionCopy[action] : null;

  useEffect(() => {
    if (action) setReason('');
  }, [action]);

  async function run() {
    setPending(true);
    try {
      const result = await adminAccountAction(account.id, { action, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      notify({ title: copy.done, description: result.data.changed ? undefined : 'Nothing needed to change.' });
      onDone(result.data.account);
      onOpenChange(false);
    } catch (error) {
      notify({ title: 'Could not complete the action', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(action)} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        {copy ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>
                {account?.email}. {copy.description}
              </DialogDescription>
            </DialogHeader>
            {copy.reason !== 'none' ? (
              <div className="space-y-2 py-2">
                <Label htmlFor="action-reason">Note for the audit trail (optional)</Label>
                <Textarea id="action-reason" rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} placeholder="Why this was done" />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" loading={pending} onClick={run}>
                {copy.confirm}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

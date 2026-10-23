import { useEffect, useState } from 'react';
import { AdminAccountAction } from '@appenglish/auth-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { adminAccountAction } from '../../auth/api/auth-api.js';
import { resetLearnerPlacement } from '../api/learner-api.js';

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
  [AdminAccountAction.ACTIVATE]: {
    title: 'Activate without the code',
    description: 'The account becomes active even though the email was never verified. Do this only when you have checked who the person is; the reason is kept in the history.',
    confirm: 'Activate account',
    done: 'Account activated',
    reason: 'required',
  },
  [AdminAccountAction.RESEND_VERIFICATION]: {
    title: 'Send a new verification code',
    description: 'The person receives a new six-digit code valid for five minutes and verifies the email on the sign-up page.',
    confirm: 'Send the code',
    done: 'Verification code sent',
    reason: 'none',
  },
  [AdminAccountAction.RESEND_INVITE]: {
    title: 'Send the invitation again',
    description: 'The person receives a new invitation code valid for 72 hours and chooses a password with it. Earlier codes stop working.',
    confirm: 'Send the invitation',
    done: 'Invitation sent',
    reason: 'none',
  },
  [AdminAccountAction.RESET_PLACEMENT]: {
    title: 'Reset the placement test',
    description: 'The result of the placement test is removed: the learner takes or skips it again and gets a new starting unit. Lessons already completed and test results are kept.',
    confirm: 'Reset placement',
    done: 'Placement test reset',
    reason: 'optional',
  },
});

async function runAction(account, action, reason) {
  if (action === AdminAccountAction.RESET_PLACEMENT) {
    const result = await resetLearnerPlacement(account.id, reason);
    return { account: result.data.account, changed: result.data.reset, detail: result.data.reset ? undefined : 'The learner had not taken the placement test yet.' };
  }
  const result = await adminAccountAction(account.id, { action, ...(reason ? { reason } : {}) });
  return { account: result.data.account, changed: result.data.changed, detail: result.data.changed ? undefined : 'Nothing needed to change.' };
}

export function AccountActionDialog({ account, action, onOpenChange, onDone }) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const copy = action ? actionCopy[action] : null;

  useEffect(() => {
    if (action) setReason('');
  }, [action]);

  const ready = copy?.reason !== 'required' || reason.trim().length > 0;

  async function run() {
    setPending(true);
    try {
      const result = await runAction(account, action, reason.trim());
      notify({ title: copy.done, description: result.detail });
      onDone(result.account);
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
                <Label htmlFor="action-reason">{copy.reason === 'required' ? 'Reason (required, kept in the history)' : 'Note for the audit trail (optional)'}</Label>
                <Textarea id="action-reason" rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} placeholder={copy.reason === 'required' ? 'How you checked the person, or why the code could not be used' : 'Why this was done'} />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" loading={pending} disabled={!ready} onClick={run}>
                {copy.confirm}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

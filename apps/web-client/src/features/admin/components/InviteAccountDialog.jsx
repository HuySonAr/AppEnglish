import { useEffect, useState } from 'react';
import { AccountRole, PROFILE_LIMITS } from '@appenglish/auth-contracts';
import { RoleLabels } from '../../../constants/auth.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui';
import { inviteAdminAccount } from '../../auth/api/auth-api.js';

export function InviteAccountDialog({ open, onOpenChange, onInvited }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState(AccountRole.STUDENT);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setDisplayName('');
    setRole(AccountRole.STUDENT);
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await inviteAdminAccount({ email: email.trim(), displayName: displayName.trim(), role });
      notify({ title: 'Invitation sent', description: `${result.data.account.email} has ${result.data.expiresInHours} hours to choose a password.` });
      onInvited(result.data.account);
      onOpenChange(false);
    } catch (error) {
      notify({ title: 'Could not send the invitation', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Invite a new account</DialogTitle>
            <DialogDescription>The person receives an email with a code valid for 72 hours and chooses their own password. Nobody else ever sees it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" autoComplete="off" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} placeholder="name@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Display name (optional)</Label>
              <Input id="invite-name" maxLength={PROFILE_LIMITS.displayNameMax} value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={pending} placeholder="How the person is shown; they can change it" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={setRole} disabled={pending}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AccountRole).map((value) => (
                    <SelectItem key={value} value={value}>
                      {RoleLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === AccountRole.ADMIN ? 'An admin can manage every account. Make sure this is intended.' : role === AccountRole.CONTENT_MANAGER ? 'A Content Manager writes and publishes lessons, tests and listening material.' : role === AccountRole.TEACHER ? 'A teacher writes speaking and writing prompts.' : 'A learner takes the placement test, lessons and mock tests.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!email.trim()}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

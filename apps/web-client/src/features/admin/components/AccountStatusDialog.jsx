import { useEffect, useState } from 'react';
import { AccountRole, AccountStatus } from '@appenglish/auth-contracts';
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { updateAdminAccount } from '../../auth/api/auth-api.js';
import { lockReasonRequired, statusLabels } from '../lib/accounts.js';

const editableStatuses = [AccountStatus.ACTIVE, AccountStatus.DISABLED, AccountStatus.SUSPENDED];

// Role and status of one account (F01B, D114). Locking needs a reason the
// person is shown at sign-in; every change signs the account out everywhere.
export function AccountStatusDialog({ account, open, onOpenChange, onSaved }) {
  const [role, setRole] = useState(account?.role);
  const [status, setStatus] = useState(account?.status);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRole(account?.role);
    setStatus(account?.status);
    setReason(account?.statusReason && account.status !== AccountStatus.ACTIVE ? account.statusReason : '');
  }, [open, account]);

  const pendingVerification = account?.status === AccountStatus.PENDING_VERIFICATION;
  const needsReason = lockReasonRequired(account?.status, status);
  const changed = role !== account?.role || status !== account?.status;
  const ready = changed && (!needsReason || reason.trim().length > 0);
  const locking = status !== AccountStatus.ACTIVE && status !== AccountStatus.PENDING_VERIFICATION;

  async function save() {
    setPending(true);
    try {
      const changes = {};
      if (role !== account.role) changes.role = role;
      if (status !== account.status) changes.status = status;
      if (needsReason) changes.reason = reason.trim();
      const result = await updateAdminAccount(account.id, changes);
      onSaved(result.data.account);
      notify({ title: 'Account updated', description: 'The account was signed out of every device.' });
      onOpenChange(false);
    } catch (error) {
      notify({ title: 'Could not update the account', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Role and status</DialogTitle>
          <DialogDescription>
            Changing either signs {account?.email} out of every device. Email verification stays an OTP-only step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="account-role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={pending}>
              <SelectTrigger id="account-role">
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
            {role === AccountRole.ADMIN && account?.role !== AccountRole.ADMIN ? (
              <p className="text-xs text-warning">An admin can manage every account. Make sure this is intended.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-status">Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={pending || pendingVerification}>
              <SelectTrigger id="account-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pendingVerification ? <SelectItem value={AccountStatus.PENDING_VERIFICATION}>{statusLabels[AccountStatus.PENDING_VERIFICATION]}</SelectItem> : null}
                {editableStatuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {pendingVerification
                ? 'The status changes to Active once the person verifies their email.'
                : 'Suspended is temporary and meant to be lifted; Disabled closes the account for good.'}
            </p>
          </div>
          {locking ? (
            <div className="space-y-2">
              <Label htmlFor="account-reason">Reason {needsReason ? '(required)' : ''}</Label>
              <Textarea
                id="account-reason"
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="What the person will read when they try to sign in"
                disabled={pending || !needsReason}
              />
              <p className="text-xs text-muted-foreground">Shown to the person at sign-in and kept in the audit trail. {reason.trim().length}/300</p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant={locking && changed ? 'destructive' : 'default'} loading={pending} disabled={!ready} onClick={save}>
            {locking && changed ? `Confirm and ${status === AccountStatus.DISABLED ? 'disable' : 'suspend'}` : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

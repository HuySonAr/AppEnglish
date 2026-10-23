import { AccountAuditAction, AccountRole, AccountStatus, AdminAccountAction, AdminAccountSort, ADMIN_STATS_DAYS } from '@appenglish/auth-contracts';

export const statusLabels = Object.freeze({
  [AccountStatus.PENDING_VERIFICATION]: 'Pending verification',
  [AccountStatus.ACTIVE]: 'Active',
  [AccountStatus.DISABLED]: 'Disabled',
  [AccountStatus.SUSPENDED]: 'Suspended',
});

export const statusVariants = Object.freeze({
  [AccountStatus.PENDING_VERIFICATION]: 'info',
  [AccountStatus.ACTIVE]: 'success',
  [AccountStatus.DISABLED]: 'destructive',
  [AccountStatus.SUSPENDED]: 'warning',
});

export const sortOptions = Object.freeze([
  { value: AdminAccountSort.NEWEST, label: 'Newest first' },
  { value: AdminAccountSort.OLDEST, label: 'Oldest first' },
  { value: AdminAccountSort.LAST_LOGIN, label: 'Last sign-in' },
  { value: AdminAccountSort.EMAIL, label: 'Email A–Z' },
]);

export function lockReasonRequired(previousStatus, nextStatus) {
  return nextStatus !== previousStatus && nextStatus !== AccountStatus.ACTIVE && nextStatus !== AccountStatus.PENDING_VERIFICATION;
}

export function auditDescription(audit, labels = { status: statusLabels, role: {} }) {
  const role = (value) => labels.role[value] || value;
  const status = (value) => labels.status[value] || value;
  switch (audit.action) {
    case AccountAuditAction.ROLE_UPDATED:
      return `Role changed from ${role(audit.previousRole)} to ${role(audit.nextRole)}`;
    case AccountAuditAction.STATUS_UPDATED:
      return `Status changed from ${status(audit.previousStatus)} to ${status(audit.nextStatus)}`;
    case AccountAuditAction.ROLE_STATUS_UPDATED:
      return `Role ${role(audit.previousRole)} → ${role(audit.nextRole)}, status ${status(audit.previousStatus)} → ${status(audit.nextStatus)}`;
    case AccountAuditAction.SESSIONS_REVOKED:
      return 'Signed out of every device';
    case AccountAuditAction.PASSWORD_RESET_SENT:
      return 'Password reset email sent';
    case AccountAuditAction.AVATAR_REMOVED:
      return 'Profile picture removed';
    case AccountAuditAction.DISPLAY_NAME_RESET:
      return 'Display name reset';
    case AccountAuditAction.ACCOUNT_INVITED:
      return `Invited as ${role(audit.nextRole)}`;
    case AccountAuditAction.INVITE_RESENT:
      return 'Invitation sent again';
    case AccountAuditAction.INVITE_ACCEPTED:
      return 'Accepted the invitation and chose a password';
    case AccountAuditAction.VERIFICATION_RESENT:
      return 'Verification code sent again';
    case AccountAuditAction.ACCOUNT_ACTIVATED:
      return 'Activated without the verification code';
    case AccountAuditAction.PLACEMENT_RESET:
      return 'Placement test reset';
    default:
      return audit.action;
  }
}

const dayKey = (date) => date.toISOString().slice(0, 10);

export function signupSeries(newPerDay = [], { days = ADMIN_STATS_DAYS, today = new Date() } = {}) {
  const counts = new Map(newPerDay.map((row) => [row.day, row.count]));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - 1 - index));
    const day = dayKey(date);
    return { day, count: counts.get(day) || 0 };
  });
}

export function statusBreakdown(byStatus = {}, total = 0) {
  return Object.keys(statusLabels).map((status) => {
    const count = byStatus[status] || 0;
    return { status, label: statusLabels[status], count, percent: total ? Math.round((count * 100) / total) : 0 };
  });
}

export function timeAgo(iso, now = new Date()) {
  if (!iso) return '';
  const diff = Math.max(0, now - new Date(iso));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export function isInvitedPending(account) {
  return account?.status === AccountStatus.PENDING_VERIFICATION && Boolean(account.invitedAt);
}

export function availableActions(account) {
  if (!account) return [];
  const pending = account.status === AccountStatus.PENDING_VERIFICATION;
  const invited = isInvitedPending(account);
  const actions = [];
  if (pending && invited) actions.push(AdminAccountAction.RESEND_INVITE);
  if (pending && !invited) actions.push(AdminAccountAction.RESEND_VERIFICATION, AdminAccountAction.ACTIVATE);
  if (account.status === AccountStatus.ACTIVE) actions.push(AdminAccountAction.SEND_PASSWORD_RESET);
  actions.push(AdminAccountAction.REVOKE_SESSIONS);
  if (account.role === AccountRole.STUDENT) actions.push(AdminAccountAction.RESET_PLACEMENT);
  return actions;
}

export function statusChoices(account) {
  switch (account?.status) {
    case AccountStatus.ACTIVE:
      return [AccountStatus.SUSPENDED, AccountStatus.DISABLED];
    case AccountStatus.SUSPENDED:
      return [AccountStatus.ACTIVE, AccountStatus.DISABLED];
    case AccountStatus.DISABLED:
      return [AccountStatus.ACTIVE, AccountStatus.SUSPENDED];
    default:
      return [];
  }
}

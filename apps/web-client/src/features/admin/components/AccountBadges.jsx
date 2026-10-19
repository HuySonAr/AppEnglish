import { Badge } from '../../../components/ui';
import { RoleLabels } from '../../../constants/auth.js';
import { statusLabels, statusVariants } from '../lib/accounts.js';

export function StatusBadge({ status, className }) {
  return (
    <Badge variant={statusVariants[status] || 'secondary'} className={className}>
      {statusLabels[status] || status}
    </Badge>
  );
}

export function RoleBadge({ role, className }) {
  return (
    <Badge variant="secondary" className={className}>
      {RoleLabels[role] || role}
    </Badge>
  );
}

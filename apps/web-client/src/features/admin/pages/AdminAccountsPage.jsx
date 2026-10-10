import { useEffect, useState } from 'react';
import { AccountRole, AccountStatus } from '@appenglish/auth-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import {
  listAdminAccounts,
  updateAdminAccount,
} from '../../auth/api/auth-api.js';
import { useToast } from '../../../hooks/use-toast.js';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Skeleton,
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { Users } from 'lucide-react';

const editableStatuses = [
  AccountStatus.ACTIVE,
  AccountStatus.DISABLED,
  AccountStatus.SUSPENDED,
];

const statusLabels = {
  PENDING_VERIFICATION: 'Pending verification',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  SUSPENDED: 'Suspended',
};

const roleLabels = {
  STUDENT: 'Student',
  CONTENT_MANAGER: 'Content Manager',
  ADMIN: 'Admin',
};

function StatusBadge({ status }) {
  const variant =
    status === AccountStatus.ACTIVE
      ? 'success'
      : status === AccountStatus.DISABLED
        ? 'destructive'
        : status === AccountStatus.SUSPENDED
          ? 'warning'
          : 'info';
  return <Badge variant={variant}>{statusLabels[status] || status}</Badge>;
}

function RoleBadge({ role }) {
  return <Badge variant="secondary">{roleLabels[role] || role}</Badge>;
}

export function AdminAccountsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    email: '',
    role: '',
    status: '',
    page: 1,
  });
  const [result, setResult] = useState(null);
  const [state, setState] = useState('loading');
  const [pending, setPending] = useState(null);

  async function load() {
    setState('loading');
    try {
      setResult(await listAdminAccounts({ ...filters, pageSize: 20 }));
      setState('ready');
    } catch (error) {
      setState('error');
      toast({
        title: 'Could not load accounts',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, [filters.email, filters.role, filters.status, filters.page]);

  async function save() {
    if (!pending) return;
    const loadingToast = toast({
      title: 'Updating account…',
    });
    try {
      const changes = { role: pending.role };
      if (editableStatuses.includes(pending.status))
        changes.status = pending.status;
      await updateAdminAccount(pending.id, changes);
      toast({ title: 'Account updated' });
      setPending(null);
      await load();
    } catch (error) {
      toast({
        title: 'Account update failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      loadingToast.dismiss();
    }
  }

  const items = result?.data?.items || [];
  const pagination = result?.data?.pagination;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Account management"
        description="Search accounts, change roles, lock and unlock access."
      />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder="Search email"
          value={filters.email}
          onChange={(event) =>
            setFilters({ ...filters, email: event.target.value, page: 1 })
          }
          className="w-full sm:w-[300px]"
        />
        <Select
          value={filters.role}
          onValueChange={(value) =>
            setFilters({ ...filters, role: value, page: 1 })
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All roles</SelectItem>
            {Object.values(AccountRole).map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabels[role] || role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            setFilters({ ...filters, status: value, page: 1 })
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {Object.values(AccountStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status] || status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state === 'loading' ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-[200px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[40px]" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts found"
          description="Try a different search or filter."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden md:table-cell">Verified</TableHead>
                <TableHead className="w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={account.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={account.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {account.emailVerifiedAt
                      ? new Date(account.emailVerifiedAt).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPending({
                          id: account.id,
                          email: account.email,
                          role: account.role,
                          status: account.status,
                        })
                      }
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= pagination.totalPages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      ) : null}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {pending?.email}</DialogTitle>
            <DialogDescription>
              This changes authorization and invalidates active sessions. Email
              verification remains an OTP-only operation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={pending?.role}
                onValueChange={(value) =>
                  setPending({ ...pending, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AccountRole).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role] || role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={pending?.status}
                onValueChange={(value) =>
                  setPending({ ...pending, status: value })
                }
                disabled={!editableStatuses.includes(pending?.status)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pending?.status === AccountStatus.PENDING_VERIFICATION ? (
                    <SelectItem value={AccountStatus.PENDING_VERIFICATION}>
                      {statusLabels[AccountStatus.PENDING_VERIFICATION]}
                    </SelectItem>
                  ) : null}
                  {editableStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

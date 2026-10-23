import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock3, Eye, KeyRound, Lock, LogOut, MailPlus, MoreHorizontal, PauseCircle, RotateCcw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AccountRole, AccountStatus, AdminAccountAction, AdminAccountSort, displayNameOf } from '@appenglish/auth-contracts';
import { RoleLabels } from '../../../constants/auth.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { listAdminAccounts } from '../../auth/api/auth-api.js';
import { AccountActionDialog, actionCopy } from '../components/AccountActionDialog.jsx';
import { AccountStatusDialog } from '../components/AccountStatusDialog.jsx';
import { InviteAccountDialog } from '../components/InviteAccountDialog.jsx';
import { availableActions, isInvitedPending, sortOptions, statusChoices, statusLabels, timeAgo } from '../lib/accounts.js';

const defaults = { search: '', role: '', status: '', stale: false, sort: AdminAccountSort.NEWEST, pageSize: '20' };

const statusLook = {
  [AccountStatus.ACTIVE]: { icon: CheckCircle2, className: 'bg-success/15 text-success hover:bg-success/25' },
  [AccountStatus.PENDING_VERIFICATION]: { icon: Clock3, className: 'bg-info/15 text-info hover:bg-info/25' },
  [AccountStatus.SUSPENDED]: { icon: PauseCircle, className: 'bg-warning/15 text-warning hover:bg-warning/25' },
  [AccountStatus.DISABLED]: { icon: Lock, className: 'bg-destructive/15 text-destructive hover:bg-destructive/25' },
};

const actionIcons = {
  [AdminAccountAction.REVOKE_SESSIONS]: LogOut,
  [AdminAccountAction.SEND_PASSWORD_RESET]: KeyRound,
  [AdminAccountAction.RESEND_VERIFICATION]: MailPlus,
  [AdminAccountAction.RESEND_INVITE]: MailPlus,
  [AdminAccountAction.ACTIVATE]: ShieldCheck,
  [AdminAccountAction.RESET_PLACEMENT]: RotateCcw,
};

const columns = 'grid-cols-[minmax(14rem,1fr)_10rem_11rem_8rem_8rem_5.5rem]';

function RowsSkeleton() {
  return (
    <div className="divide-y">
      {[...Array(8)].map((_, index) => (
        <div key={index} className={cn('grid items-center gap-3 px-4 py-3', columns)}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function StatusPill({ account, onStatus, onAction }) {
  const look = statusLook[account.status] || statusLook[AccountStatus.ACTIVE];
  const Icon = look.icon;
  const invited = isInvitedPending(account);
  const pending = account.status === AccountStatus.PENDING_VERIFICATION;
  const choices = statusChoices(account);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', look.className)}
          aria-label={`Status: ${statusLabels[account.status]}. Change`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{pending ? (invited ? 'Invited' : 'Pending') : statusLabels[account.status]}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {pending ? (invited ? `Invited ${timeAgo(account.invitedAt)}, not accepted yet` : 'Registered, email not verified') : account.statusReason ? `“${account.statusReason}”` : statusLabels[account.status]}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pending ? (
          <>
            <DropdownMenuItem onSelect={() => onAction(account, invited ? AdminAccountAction.RESEND_INVITE : AdminAccountAction.RESEND_VERIFICATION)}>
              <MailPlus className="mr-2 h-4 w-4" />
              {invited ? 'Resend the invitation' : 'Send a new code'}
            </DropdownMenuItem>
            {invited ? null : (
              <DropdownMenuItem onSelect={() => onAction(account, AdminAccountAction.ACTIVATE)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Activate without the code…
              </DropdownMenuItem>
            )}
          </>
        ) : (
          choices.map((status) => {
            const Next = statusLook[status].icon;
            return (
              <DropdownMenuItem key={status} onSelect={() => onStatus(account, status)}>
                <Next className="mr-2 h-4 w-4" />
                {status === AccountStatus.ACTIVE ? 'Restore to Active' : `${statusLabels[status]}…`}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountRow({ account, isMe, onRole, onStatus, onAction }) {
  const actions = availableActions(account);
  return (
    <TableRow className="group">
      <TableCell className="min-w-[14rem]">
        <div className="flex items-center gap-3">
          <Avatar account={account} size="md" />
          <div className="min-w-0">
            <Link to={`/admin/accounts/${account.id}`} className="block truncate font-medium hover:underline focus-visible:outline-none focus-visible:underline">
              {displayNameOf(account)}
              {isMe ? <span className="ml-2 text-xs font-normal text-muted-foreground">you</span> : null}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Select value={account.role} onValueChange={(role) => role !== account.role && onRole(account, role)} disabled={isMe}>
          <SelectTrigger aria-label={`Role of ${account.email}`} className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(AccountRole).map((role) => (
              <SelectItem key={role} value={role}>
                {RoleLabels[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <StatusPill account={account} onStatus={onStatus} onAction={onAction} />
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell" title={new Date(account.createdAt).toLocaleString()}>
        {new Date(account.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground md:table-cell" title={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : undefined}>
        {account.lastLoginAt ? timeAgo(account.lastLoginAt) : 'Never'}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link to={`/admin/accounts/${account.id}`} aria-label={`Open ${account.email}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${account.email}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem asChild>
                <Link to={`/admin/accounts/${account.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Open the account page
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {actions.map((action) => {
                const Icon = actionIcons[action];
                return (
                  <DropdownMenuItem key={action} onSelect={() => onAction(account, action)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {actionCopy[action].title}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AdminAccountsPage() {
  const { account: me } = useAuth();
  const { filters, setFilter, setFilters, page, setPage } = useListState(defaults);
  const [list, setList] = useState({ state: 'loading', items: [], pagination: null });
  const [dialog, setDialog] = useState(null);
  const pageSize = Number(filters.pageSize) || 20;

  async function loadList() {
    setList((current) => ({ ...current, state: 'loading' }));
    try {
      const result = await listAdminAccounts({
        search: filters.search,
        role: filters.role,
        status: filters.status,
        sort: filters.sort,
        stale: filters.stale ? 'true' : '',
        page,
        pageSize,
      });
      setList({ state: 'ready', items: result.data.items, pagination: result.data.pagination });
    } catch (error) {
      setList((current) => ({ ...current, state: 'error' }));
      notify({ title: 'Could not load accounts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    loadList();
  }, [filters.search, filters.role, filters.status, filters.stale, filters.sort, page, pageSize]);

  const replaceRow = (account) => {
    if (!account) return;
    setList((current) => ({ ...current, items: current.items.map((item) => (item.id === account.id ? { ...item, ...account } : item)) }));
  };
  const close = (open) => !open && setDialog(null);
  const filtered = filters.search || filters.role || filters.status || filters.stale;
  const total = list.pagination?.total;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={
          <>
            Accounts
            {total !== undefined ? <span className="ml-2 text-xl font-normal text-muted-foreground">({total})</span> : null}
          </>
        }
        description="Everyone who uses AppEnglish. Change a role or status in the row, open ⋯ for the other actions, or invite someone new."
        actions={
          <Button onClick={() => setDialog({ kind: 'invite' })}>
            <UserPlus className="h-4 w-4" />
            Add account
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
          <SearchField label="Search accounts" placeholder="Search by email or name…" value={filters.search} onChange={setFilter('search')} />
          <FilterSelect
            label="Role"
            value={filters.role || 'all'}
            onChange={(value) => setFilter('role')(value === 'all' ? '' : value)}
            options={[{ value: 'all', label: 'All roles' }, ...Object.values(AccountRole).map((role) => ({ value: role, label: RoleLabels[role] }))]}
            className="w-full lg:w-44"
          />
          <FilterSelect
            label="Status"
            value={filters.status || 'all'}
            onChange={(value) => setFilter('status')(value === 'all' ? '' : value)}
            options={[{ value: 'all', label: 'All statuses' }, ...Object.values(AccountStatus).map((status) => ({ value: status, label: statusLabels[status] }))]}
            className="w-full lg:w-48"
          />
          <FilterSelect label="Sort" value={filters.sort} onChange={setFilter('sort')} options={sortOptions} className="w-full lg:w-40" />
          <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm lg:ml-auto">
            <Switch checked={filters.stale} onCheckedChange={setFilter('stale')} aria-label="Only pending for over a week" />
            <span className="whitespace-nowrap">Pending over a week</span>
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {list.state === 'loading' ? (
            <RowsSkeleton />
          ) : list.state === 'error' ? (
            <div className="p-6 text-center">
              <Button variant="outline" onClick={loadList}>
                Try again
              </Button>
            </div>
          ) : list.items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Users}
                title={filtered ? 'No account matches' : 'No accounts yet'}
                description={filtered ? 'Try another search or filter.' : 'Accounts appear here as people register or are invited.'}
                action={filtered ? <Button variant="outline" onClick={() => setFilters({ ...defaults, pageSize: filters.pageSize })}>Clear filters</Button> : null}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                    <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      isMe={me?.id === account.id}
                      onRole={(target, role) => setDialog({ kind: 'status', account: target, preset: { role } })}
                      onStatus={(target, status) => setDialog({ kind: 'status', account: target, preset: { status } })}
                      onAction={(target, action) => setDialog({ kind: 'action', account: target, action })}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {list.pagination ? (
          <Pagination
            page={list.pagination.page}
            pageCount={list.pagination.totalPages}
            total={list.pagination.total}
            noun="account"
            onChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => setFilter('pageSize')(String(size))}
          />
        ) : null}
      </div>

      <InviteAccountDialog open={dialog?.kind === 'invite'} onOpenChange={close} onInvited={loadList} />
      <AccountStatusDialog account={dialog?.kind === 'status' ? dialog.account : null} preset={dialog?.kind === 'status' ? dialog.preset : null} open={dialog?.kind === 'status'} onOpenChange={close} onSaved={replaceRow} />
      <AccountActionDialog account={dialog?.kind === 'action' ? dialog.account : null} action={dialog?.kind === 'action' ? dialog.action : null} onOpenChange={close} onDone={replaceRow} />
    </section>
  );
}

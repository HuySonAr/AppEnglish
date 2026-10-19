import { useEffect, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AccountRole, AccountStatus, AdminAccountSort } from '@appenglish/auth-contracts';
import { RoleLabels } from '../../../constants/auth.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button, Skeleton, Switch } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { getAdminAccountStats, listAdminAccounts } from '../../auth/api/auth-api.js';
import { AccountStats, AccountStatsSkeleton } from '../components/AccountStats.jsx';
import { RoleBadge, StatusBadge } from '../components/AccountBadges.jsx';
import { sortOptions, statusLabels, timeAgo } from '../lib/accounts.js';

const PAGE_SIZE = 20;
const initialFilters = { search: '', role: '', status: '', stale: false, sort: AdminAccountSort.NEWEST, page: 1 };

function RowsSkeleton() {
  return (
    <ul className="divide-y">
      {[...Array(6)].map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="hidden h-5 w-20 md:block" />
          <Skeleton className="hidden h-5 w-24 md:block" />
        </li>
      ))}
    </ul>
  );
}

// Admin account management (F01B, D114): the numbers, then the list with
// search, filters, sort and server paging; each row opens the account page.
// Filters the dashboard links to: ?status=SUSPENDED, ?stale=true, ?role=…
function filtersFromUrl(params) {
  return {
    ...initialFilters,
    role: Object.values(AccountRole).includes(params.get('role')) ? params.get('role') : '',
    status: Object.values(AccountStatus).includes(params.get('status')) ? params.get('status') : '',
    stale: params.get('stale') === 'true',
  };
}

export function AdminAccountsPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromUrl(searchParams));
  const [list, setList] = useState({ state: 'loading', items: [], pagination: null });
  const [stats, setStats] = useState({ state: 'loading', data: null });

  async function loadStats() {
    setStats({ state: 'loading', data: null });
    try {
      setStats({ state: 'ready', data: (await getAdminAccountStats()).data });
    } catch {
      setStats({ state: 'error', data: null });
    }
  }

  async function loadList() {
    setList((current) => ({ ...current, state: 'loading' }));
    try {
      const result = await listAdminAccounts({
        search: filters.search,
        role: filters.role,
        status: filters.status,
        sort: filters.sort,
        stale: filters.stale ? 'true' : '',
        page: filters.page,
        pageSize: PAGE_SIZE,
      });
      setList({ state: 'ready', items: result.data.items, pagination: result.data.pagination });
    } catch (error) {
      setList((current) => ({ ...current, state: 'error' }));
      notify({ title: 'Could not load accounts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    loadStats();
  }, []);
  useEffect(() => {
    loadList();
  }, [filters.search, filters.role, filters.status, filters.stale, filters.sort, filters.page]);

  const setFilter = (key) => (value) => setFilters({ ...filters, [key]: value, page: 1 });
  const filtered = filters.search || filters.role || filters.status || filters.stale;

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Admin" title="Accounts" description="Who uses AppEnglish: numbers, the full list, and each account's page with its history and actions." />

      {stats.state === 'loading' ? (
        <AccountStatsSkeleton />
      ) : stats.state === 'error' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <span className="text-muted-foreground">The statistics could not be loaded.</span>
          <Button variant="outline" size="sm" onClick={loadStats}>
            Try again
          </Button>
        </div>
      ) : (
        <AccountStats stats={stats.data} />
      )}

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
            <Switch checked={filters.stale} onCheckedChange={setFilter('stale')} aria-label="Only stale sign-ups" />
            <span className="whitespace-nowrap">Stale sign-ups only</span>
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="hidden grid-cols-[1fr_9rem_9rem_8rem_2rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Account</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last sign-in</span>
            <span />
          </div>
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
                description={filtered ? 'Try another search or filter.' : 'Accounts appear here as people register.'}
                action={filtered ? <Button variant="outline" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : null}
              />
            </div>
          ) : (
            <ul className="divide-y">
              {list.items.map((account) => (
                <li key={account.id}>
                  <Link
                    to={`/admin/accounts/${account.id}`}
                    className={cn(
                      'grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      'md:grid-cols-[1fr_9rem_9rem_8rem_2rem]',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3 md:col-span-1">
                      <Avatar account={account} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{account.displayName || account.email.split('@')[0]}</span>
                        <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 md:contents">
                      <RoleBadge role={account.role} />
                      <StatusBadge status={account.status} />
                      <span className="hidden text-sm text-muted-foreground md:block" title={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : undefined}>
                        {account.lastLoginAt ? timeAgo(account.lastLoginAt) : 'Never'}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {list.pagination ? (
          <Pagination page={list.pagination.page} pageCount={list.pagination.totalPages} total={list.pagination.total} noun="account" onChange={(page) => setFilters({ ...filters, page })} />
        ) : null}
      </div>
    </section>
  );
}

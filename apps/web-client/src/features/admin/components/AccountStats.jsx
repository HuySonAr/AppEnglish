import { Activity, Clock, UserCheck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { AccountRole } from '@appenglish/auth-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, ChartContainer, ChartTooltip, Skeleton } from '../../../components/ui';
import { RoleLabels } from '../../../constants/auth.js';
import { cn } from '../../../lib/utils.js';
import { signupSeries, statusBreakdown } from '../lib/accounts.js';

// The numbers behind the accounts page (D114): tiles, sign-ups per day and
// the status breakdown. Colours: --chart-1 for the single series; status bars
// carry their label and count, never colour alone.
const series = 'hsl(var(--chart-1))';
const statusTone = {
  PENDING_VERIFICATION: 'bg-info',
  ACTIVE: 'bg-success',
  DISABLED: 'bg-destructive',
  SUSPENDED: 'bg-warning',
};

export function Tile({ icon: Icon, label, value, detail, tone = 'bg-primary/10 text-primary' }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

const shortDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function SignupsChart({ points }) {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  return (
    <ChartContainer
      config={{ count: { label: 'Sign-ups', color: series } }}
      className="aspect-auto h-48 w-full"
      role="img"
      aria-label={`Sign-ups per day over ${points.length} days, ${total} in total`}
    >
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval={6} tickFormatter={shortDay} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          content={({ active, payload }) => {
            const point = active ? payload?.[0]?.payload : null;
            if (!point) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                <p className="font-medium">{new Date(`${point.day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>
                <p className="text-muted-foreground">
                  {point.count} sign-up{point.count === 1 ? '' : 's'}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export function StatusBars({ rows }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.status} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', statusTone[row.status])} aria-hidden="true" />
              {row.label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{row.count}</span> · {row.percent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className={cn('h-full rounded-full transition-all', statusTone[row.status])} style={{ width: `${row.percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AccountStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-[88px] rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function AccountStats({ stats }) {
  const points = signupSeries(stats.newPerDay, { days: stats.days });
  const recent = points.reduce((sum, point) => sum + point.count, 0);
  const rows = statusBreakdown(stats.byStatus, stats.total);
  const active = stats.byStatus?.ACTIVE || 0;
  const roles = Object.values(AccountRole).map((role) => `${stats.byRole?.[role] || 0} ${RoleLabels[role].toLowerCase()}${(stats.byRole?.[role] || 0) === 1 ? '' : 's'}`);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Users} label="All accounts" value={stats.total} detail={roles.join(' · ')} />
        <Tile icon={UserCheck} label="Active" value={active} detail={stats.total ? `${Math.round((active * 100) / stats.total)}% of all accounts` : 'No accounts yet'} tone="bg-success/10 text-success" />
        <Tile icon={Activity} label="Signed in this week" value={stats.activeLast7Days} detail="Accounts with a sign-in in the last 7 days" tone="bg-chart-2/10 text-chart-2" />
        <Tile icon={Clock} label="Stale sign-ups" value={stats.stalePending} detail="Pending verification for over 7 days" tone="bg-warning/10 text-warning" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New accounts</CardTitle>
            <CardDescription>
              {recent} sign-up{recent === 1 ? '' : 's'} in the last {stats.days} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupsChart points={points} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By status</CardTitle>
            <CardDescription>Share of all accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBars rows={rows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

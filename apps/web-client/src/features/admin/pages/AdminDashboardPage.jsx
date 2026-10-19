import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Calculator, CheckCircle2, ClipboardCheck, Layers, RefreshCw, ShieldAlert, Tags, TrendingDown, TrendingUp, UserPlus, Users, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminAccountSort } from '@appenglish/auth-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { getAdminAccountStats, listAdminAccounts } from '../../auth/api/auth-api.js';
import { greeting } from '../../student/lib/home.js';
import { getServicesHealth } from '../api/system-api.js';
import { SignupsChart, StatusBars, Tile } from '../components/AccountStats.jsx';
import { RoleBadge, StatusBadge } from '../components/AccountBadges.jsx';
import { signupSeries, statusBreakdown, timeAgo } from '../lib/accounts.js';
import { attentionItems, overallHealth, weeklyTrend } from '../lib/dashboard.js';

const tones = {
  warning: 'border-warning/40 bg-warning/10 text-warning',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-info/40 bg-info/10 text-info',
};
const healthCopy = {
  ok: { label: 'All systems normal', variant: 'success', icon: CheckCircle2 },
  degraded: { label: 'Some services are down', variant: 'warning', icon: AlertTriangle },
  down: { label: 'Backend unreachable', variant: 'destructive', icon: XCircle },
  unknown: { label: 'Not checked yet', variant: 'secondary', icon: Activity },
};

// Services and whether they answer (D115); refreshed on demand.
function SystemHealth() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  async function load() {
    setState('loading');
    try {
      setData((await getServicesHealth()).data ?? (await getServicesHealth()));
      setState('ready');
    } catch (error) {
      // The gateway itself did not answer: everything is down from here.
      setData({ services: [], checkedAt: new Date().toISOString(), gatewayError: getApiErrorMessage(error) });
      setState('ready');
    }
  }
  useEffect(() => {
    load();
  }, []);

  const overall = state === 'ready' ? (data.gatewayError ? 'down' : overallHealth(data.services)) : 'unknown';
  const copy = healthCopy[overall];
  const rows = state === 'ready' && !data.gatewayError ? [{ name: 'api-gateway', status: 'ok' }, ...data.services] : [];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" aria-hidden="true" />
            System health
          </CardTitle>
          <CardDescription>{state === 'ready' ? `Checked ${timeAgo(data.checkedAt)}` : 'Checking…'}</CardDescription>
        </div>
        <Button variant="ghost" size="icon" aria-label="Check again" onClick={load} disabled={state === 'loading'}>
          <RefreshCw className={cn('h-4 w-4', state === 'loading' && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={copy.variant} className="gap-1.5">
          <copy.icon className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.label}
        </Badge>
        {state === 'loading' ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-9 rounded-lg" />)}
          </div>
        ) : data.gatewayError ? (
          <p className="text-sm text-muted-foreground">{data.gatewayError}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((service) => (
              <li key={service.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', service.status === 'ok' ? 'bg-success' : 'bg-destructive')} aria-hidden="true" />
                  <span className="font-medium">{service.name}</span>
                  {service.database ? <span className="text-xs text-muted-foreground">db {service.database}</span> : null}
                </span>
                <span className={cn('text-xs tabular-nums', service.status === 'ok' ? 'text-muted-foreground' : 'font-medium text-destructive')}>
                  {service.status === 'ok' ? `${service.latencyMs ?? 0} ms` : service.detail || 'down'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AccountRows({ title, description, icon: Icon, items, state, empty, meta }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {state === 'loading' ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 rounded-lg" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {items.map((account) => (
              <li key={account.id}>
                <Link to={`/admin/accounts/${account.id}`} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-accent/60">
                  <Avatar account={account} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{account.displayName || account.email.split('@')[0]}</span>
                    <span className="block truncate text-xs text-muted-foreground">{account.email}</span>
                  </span>
                  <span className="hidden sm:block">
                    <RoleBadge role={account.role} />
                  </span>
                  <span className="w-20 text-right text-xs text-muted-foreground">{meta(account)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// The admin's overview (D115): where the accounts stand, what needs a look,
// whether the backend answers, who joined and who is active, and the tools.
export function AdminDashboardPage() {
  const [stats, setStats] = useState({ state: 'loading', data: null });
  const [recent, setRecent] = useState({ state: 'loading', newest: [], active: [] });

  async function loadStats() {
    setStats({ state: 'loading', data: null });
    try {
      setStats({ state: 'ready', data: (await getAdminAccountStats()).data });
    } catch (error) {
      setStats({ state: 'error', data: null });
      notify({ title: 'Could not load the account numbers', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }
  async function loadRecent() {
    setRecent((current) => ({ ...current, state: 'loading' }));
    try {
      const [newest, active] = await Promise.all([
        listAdminAccounts({ sort: AdminAccountSort.NEWEST, page: 1, pageSize: 5 }),
        listAdminAccounts({ sort: AdminAccountSort.LAST_LOGIN, page: 1, pageSize: 5 }),
      ]);
      setRecent({ state: 'ready', newest: newest.data.items, active: active.data.items.filter((account) => account.lastLoginAt) });
    } catch {
      setRecent({ state: 'error', newest: [], active: [] });
    }
  }
  useEffect(() => {
    loadStats();
    loadRecent();
  }, []);

  const data = stats.data;
  const points = data ? signupSeries(data.newPerDay, { days: data.days }) : [];
  const trend = weeklyTrend(points);
  const attention = data ? attentionItems(data) : [];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className="space-y-8">
      <PageHeader eyebrow="Admin" title={`${greeting()}.`} description={`${today}. Here is how AppEnglish is doing.`} />

      {stats.state === 'loading' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-[88px] rounded-xl" />)}
        </div>
      ) : stats.state === 'error' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <span className="text-muted-foreground">The account numbers could not be loaded.</span>
          <Button variant="outline" size="sm" onClick={loadStats}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={Users} label="All accounts" value={data.total} detail={`${data.byRole?.STUDENT || 0} students · ${data.byRole?.CONTENT_MANAGER || 0} content managers · ${data.byRole?.ADMIN || 0} admins`} />
          <Tile
            icon={UserPlus}
            label="New this week"
            value={trend.thisWeek}
            detail={
              <span className={cn('inline-flex items-center gap-1', trend.delta > 0 && 'text-success', trend.delta < 0 && 'text-destructive')}>
                {trend.delta > 0 ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : trend.delta < 0 ? <TrendingDown className="h-3 w-3" aria-hidden="true" /> : null}
                {trend.delta === 0 ? 'Same as last week' : `${trend.delta > 0 ? '+' : ''}${trend.delta} vs last week (${trend.lastWeek})`}
              </span>
            }
            tone="bg-chart-2/10 text-chart-2"
          />
          <Tile icon={Activity} label="Signed in this week" value={data.activeLast7Days} detail={data.total ? `${Math.round((data.activeLast7Days * 100) / data.total)}% of all accounts` : 'No accounts yet'} tone="bg-success/10 text-success" />
          <Tile icon={ShieldAlert} label="Needs attention" value={attention.reduce((sum, item) => sum + item.count, 0)} detail={attention.length ? attention.map((item) => item.label).join(' · ') : 'Nothing to look at'} tone={attention.length ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Sign-ups</CardTitle>
              <CardDescription>New accounts per day over the last {data?.days || 30} days</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/accounts">
                All accounts
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>{data ? <SignupsChart points={points} /> : <Skeleton className="h-48 rounded-lg" />}</CardContent>
        </Card>
        <SystemHealth />
      </div>

      {attention.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {attention.map((item) => (
            <Link key={item.key} to={item.to} className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition hover:shadow-md', tones[item.tone])}>
              <span>
                <span className="block font-semibold">{item.label}</span>
                <span className="block text-xs opacity-80">{item.hint}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <AccountRows title="Just joined" description="The newest accounts" icon={UserPlus} state={recent.state} items={recent.newest} empty="Nobody has registered yet." meta={(account) => timeAgo(account.createdAt)} />
        <AccountRows title="Recently active" description="The latest sign-ins" icon={Activity} state={recent.state} items={recent.active} empty="No sign-in recorded yet." meta={(account) => timeAgo(account.lastLoginAt)} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accounts by status</CardTitle>
            <CardDescription>Share of all accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <StatusBars rows={statusBreakdown(data.byStatus, data.total)} />
            ) : (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-8 rounded-lg" />)}
              </div>
            )}
            {data ? (
              <p className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                <StatusBadge status="ACTIVE" className="font-normal" /> sign in freely ·
                <StatusBadge status="SUSPENDED" className="font-normal" /> temporarily locked ·
                <StatusBadge status="DISABLED" className="font-normal" /> closed
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={Users} title="Accounts" description="Roles, locks with a reason, devices, history and each learner's progress" to="/admin/accounts" />
          <FeatureCard icon={ClipboardCheck} title="Placement" description="The scores that decide a learner's starting unit" to="/admin/placement" tone="warning" />
          <FeatureCard icon={Layers} title="Exam types" description="The exams mock tests are modelled on" to="/admin/exam-types" tone="info" />
          <FeatureCard icon={Calculator} title="Score table" description="How raw answers convert to a band score" to="/admin/score-conversion" tone="success" />
          <FeatureCard icon={Tags} title="Listening topics" description="Topics of the listening practice library" to="/admin/listening-topics" tone="info" />
        </div>
      </div>
    </section>
  );
}

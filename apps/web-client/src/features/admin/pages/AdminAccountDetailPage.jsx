import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Headphones, History, KeyRound, LogOut, Mail, MailPlus, MonitorSmartphone, RotateCcw, Shield, ShieldCheck, Trash2, Trophy, UserCog, UserRoundX } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { AccountRole, AccountStatus, AdminAccountAction, displayNameOf } from '@appenglish/auth-contracts';
import { RoleLabels } from '../../../constants/auth.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { getAdminAccount } from '../../auth/api/auth-api.js';
import { getLearnerSummary } from '../api/learner-api.js';
import { RoleBadge, StatusBadge } from '../components/AccountBadges.jsx';
import { AccountActionDialog } from '../components/AccountActionDialog.jsx';
import { AccountStatusDialog } from '../components/AccountStatusDialog.jsx';
import { auditDescription, isInvitedPending, statusLabels, timeAgo } from '../lib/accounts.js';

const dateTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const date = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

function Fact({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium" title={hint}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function LearnerSummary({ accountId, onResetPlacement }) {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    setState('loading');
    getLearnerSummary(accountId)
      .then((result) => active && (setData(result.data), setState('ready')))
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [accountId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Learning</CardTitle>
        <CardDescription>Read-only: what the learner sees on their own Progress page.</CardDescription>
      </CardHeader>
      <CardContent>
        {state === 'loading' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-lg" />)}
          </div>
        ) : state === 'error' ? (
          <p className="text-sm text-muted-foreground">Progress could not be loaded right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric icon={BookOpen} label="Lessons completed" value={`${data.progress.completion.completedLessons}/${data.progress.completion.totalLessons}`} detail={data.progress.completion.percent === null ? 'No lesson published' : `${data.progress.completion.percent}% of the course`} />
            <Metric icon={Trophy} label="XP" value={`${data.xp.totalXp} XP`} detail={data.xp.rank ? `#${data.xp.rank} of ${data.xp.learnerCount} on the leaderboard` : 'No full mock test yet'} />
            <Metric icon={Headphones} label="Listening" value={data.progress.skills.listening.percent === null ? 'No data' : `${data.progress.skills.listening.percent}%`} detail={`${data.progress.skills.listening.testCount} test${data.progress.skills.listening.testCount === 1 ? '' : 's'}`} />
            <Metric icon={BookOpen} label="Reading" value={data.progress.skills.reading.percent === null ? 'No data' : `${data.progress.skills.reading.percent}%`} detail={`${data.progress.skills.reading.testCount} test${data.progress.skills.reading.testCount === 1 ? '' : 's'}`} />
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">The placement test is taken once. Reset it to let the learner take or skip it again; lessons and results are kept.</p>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={onResetPlacement}>
            <RotateCcw className="h-4 w-4" />
            Reset placement
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTrail({ audits }) {
  if (!audits.length) return <p className="text-sm text-muted-foreground">No administrative change yet.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {audits.map((audit) => (
        <li key={audit.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
          <p className="text-sm font-medium">{auditDescription(audit, { status: statusLabels, role: RoleLabels })}</p>
          {audit.reason ? <p className="mt-0.5 text-sm text-muted-foreground">“{audit.reason}”</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground" title={dateTime(audit.createdAt)}>
            {timeAgo(audit.createdAt)} · by {audit.actor === 'self' ? 'the account itself' : audit.actor || 'an administrator'}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function AdminAccountDetailPage() {
  const { accountId } = useParams();
  const { account: me } = useAuth();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState(null);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setData((await getAdminAccount(accountId)).data);
      setState('ready');
    } catch (error) {
      setState(error?.response?.status === 404 ? 'missing' : 'error');
      if (error?.response?.status !== 404) notify({ title: 'Could not load the account', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [accountId]);

  const back = (
    <PageBreadcrumb items={[{ label: 'Accounts', to: '/admin/accounts' }, { label: data?.account ? displayNameOf(data.account) : 'Account' }]} />
  );

  if (state === 'loading') return <DetailPageSkeleton aside />;
  if (state === 'missing')
    return (
      <section className="space-y-6">
        {back}
        <EmptyState icon={UserRoundX} title="Account not found" description="It may have been removed, or the link is wrong." />
      </section>
    );
  if (state === 'error')
    return (
      <section className="space-y-6">
        {back}
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      </section>
    );

  const { account, activeSessions, audits } = data;
  const name = displayNameOf(account);
  const isMe = me?.id === account.id;
  const locked = account.status === AccountStatus.DISABLED || account.status === AccountStatus.SUSPENDED;
  const invited = isInvitedPending(account);
  const refresh = () => load({ quiet: true });

  return (
    <section className="space-y-6">
      <div>{back}</div>
      <PageHeader
        eyebrow="Admin · Account"
        title={name}
        description={account.email}
        actions={
          <>
            <Button onClick={() => setEditing(true)}>
              <UserCog className="h-4 w-4" />
              Role and status
            </Button>
            {account.status === AccountStatus.ACTIVE ? (
              <Button variant="outline" onClick={() => setAction(AdminAccountAction.SEND_PASSWORD_RESET)}>
                <KeyRound className="h-4 w-4" />
                Send reset email
              </Button>
            ) : null}
            {invited ? (
              <Button variant="outline" onClick={() => setAction(AdminAccountAction.RESEND_INVITE)}>
                <MailPlus className="h-4 w-4" />
                Resend invitation
              </Button>
            ) : null}
            {account.status === AccountStatus.PENDING_VERIFICATION && !invited ? (
              <>
                <Button variant="outline" onClick={() => setAction(AdminAccountAction.RESEND_VERIFICATION)}>
                  <MailPlus className="h-4 w-4" />
                  Resend code
                </Button>
                <Button variant="outline" onClick={() => setAction(AdminAccountAction.ACTIVATE)}>
                  <ShieldCheck className="h-4 w-4" />
                  Activate
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className={cn('h-20 border-b', locked ? 'bg-destructive/10' : 'bg-muted')} aria-hidden="true" />
        <CardContent className="pb-6 pt-0">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar account={account} size="lg" className="ring-4 ring-card shadow-md" />
              <div className="space-y-1.5 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={account.role} />
                  <StatusBadge status={account.status} />
                  {isMe ? <span className="text-xs text-muted-foreground">This is you</span> : null}
                </div>
                {locked && account.statusReason ? (
                  <p className="text-sm text-muted-foreground">
                    Reason shown at sign-in: <span className="font-medium text-foreground">“{account.statusReason}”</span>
                  </p>
                ) : null}
                {invited ? (
                  <p className="text-sm text-muted-foreground">Invited {timeAgo(account.invitedAt)}; has not accepted yet. The invitation code lasts 72 hours: send it again if it expired.</p>
                ) : account.status === AccountStatus.PENDING_VERIFICATION ? (
                  <p className="text-sm text-muted-foreground">Has not verified the email yet. The person can request a new code from the sign-in page; you can send one, or activate the account with a reason.</p>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact icon={Mail} label="Email" value={account.email} />
            <Fact icon={CalendarDays} label={account.invitedAt ? 'Invited' : 'Registered'} value={date(account.createdAt)} hint={dateTime(account.createdAt)} />
            <Fact icon={Shield} label="Email verified" value={account.emailVerifiedAt ? date(account.emailVerifiedAt) : 'Not yet'} hint={dateTime(account.emailVerifiedAt)} />
            <Fact icon={MonitorSmartphone} label="Last sign-in" value={account.lastLoginAt ? timeAgo(account.lastLoginAt) : 'Never'} hint={dateTime(account.lastLoginAt)} />
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {account.role === AccountRole.STUDENT ? <LearnerSummary accountId={account.id} onResetPlacement={() => setAction(AdminAccountAction.RESET_PLACEMENT)} /> : null}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" aria-hidden="true" />
                History
              </CardTitle>
              <CardDescription>Every administrative change to this account, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTrail audits={audits} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
                Devices
              </CardTitle>
              <CardDescription>
                {activeSessions === 0 ? 'Not signed in anywhere right now.' : `Signed in on ${activeSessions} device${activeSessions === 1 ? '' : 's'}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full justify-start gap-2" disabled={activeSessions === 0} onClick={() => setAction(AdminAccountAction.REVOKE_SESSIONS)}>
                <LogOut className="h-4 w-4" />
                Sign out of every device
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profile moderation</CardTitle>
              <CardDescription>Shown to other learners on the leaderboards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Avatar account={account} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{account.displayName ? 'Chosen display name' : 'No display name set'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled={!account.avatarUrl} onClick={() => setAction(AdminAccountAction.REMOVE_AVATAR)}>
                <Trash2 className="h-4 w-4" />
                Remove picture
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled={!account.displayName} onClick={() => setAction(AdminAccountAction.RESET_DISPLAY_NAME)}>
                <UserRoundX className="h-4 w-4" />
                Reset display name
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AccountStatusDialog account={account} open={editing} onOpenChange={setEditing} onSaved={refresh} />
      <AccountActionDialog account={account} action={action} onOpenChange={(open) => !open && setAction(null)} onDone={refresh} />
    </section>
  );
}

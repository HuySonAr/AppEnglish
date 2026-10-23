import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Inbox, RefreshCw, Server } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getSystemOverview } from '../api/system-api.js';
import { formatDuration, formatSeconds, queueHealth } from '../lib/system.js';

const REFRESH_MS = 15000;

function Figure({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ServiceCard({ service }) {
  const down = service.status !== 'ok';
  return (
    <div className={cn('space-y-3 rounded-xl border bg-card p-4 shadow-sm', down && 'border-destructive/50')}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Server className="h-4 w-4 text-muted-foreground" />
          {service.name}
        </p>
        {down ? <Badge variant="destructive">Down</Badge> : <Badge variant="success">Up</Badge>}
      </div>
      {down ? (
        <p className="text-sm text-muted-foreground">{service.detail}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Figure label="Uptime" value={formatDuration(service.uptimeSeconds)} />
            <Figure label="Memory" value={`${service.memoryMb} MB`} />
            <Figure label="CPU" value={`${service.cpuSeconds} s`} />
            <Figure label="Requests" value={service.requests} />
            <Figure label="Errors" value={service.errors} />
            <Figure label="p95" value={formatSeconds(service.p95Seconds)} />
          </div>
          {service.outbox || service.messages || service.sessions || service.speech ? (
            <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
              {service.outbox ? (
                <p>
                  Outbox: <span className="font-medium text-foreground tabular-nums">{service.outbox.published}</span> sent ·{' '}
                  <span className={cn('font-medium tabular-nums', service.outbox.pending ? 'text-warning' : 'text-foreground')}>{service.outbox.pending}</span> waiting
                </p>
              ) : null}
              {service.messages ? (
                <p>
                  Messages:{' '}
                  {Object.entries(service.messages)
                    .map(([outcome, count]) => `${count} ${outcome}`)
                    .join(' · ')}
                </p>
              ) : null}
              {service.sessions ? (
                <p>
                  Sessions:{' '}
                  {Object.entries(service.sessions)
                    .map(([source, count]) => `${count} ${source}`)
                    .join(' · ')}
                </p>
              ) : null}
              {service.speech ? (
                <p>
                  Speech jobs: {service.speech.finished} finished, {service.speech.failed} failed · wait p95 {formatSeconds(service.speech.waitP95Seconds)} · work p95{' '}
                  {formatSeconds(service.speech.workP95Seconds)}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function AdminSystemPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    setBusy(true);
    try {
      setData((await getSystemOverview()).data);
      setState('ready');
    } catch (error) {
      if (!quiet) setState('error');
      notify({ title: 'Could not load the system state', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load({ quiet: true });
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const header = (
    <PageHeader
      eyebrow="Admin"
      title="System"
      description="Services, broker queues and background jobs."
      actions={
        <Button variant="outline" className="gap-1.5" loading={busy} disabled={busy} onClick={() => load({ quiet: true })}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      }
    />
  );

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      </section>
    );

  const up = data.services.filter((service) => service.status === 'ok').length;
  const health = queueHealth(data.queues || []);

  return (
    <section className="space-y-6">
      {header}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          {up === data.services.length ? <CheckCircle2 className="h-6 w-6 text-success" /> : <AlertTriangle className="h-6 w-6 text-destructive" />}
          <div>
            <p className="text-sm text-muted-foreground">Services up</p>
            <p className="text-xl font-bold tabular-nums">
              {up}/{data.services.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <Activity className={cn('h-6 w-6', health.retrying ? 'text-warning' : 'text-success')} />
          <div>
            <p className="text-sm text-muted-foreground">Waiting to retry</p>
            <p className="text-xl font-bold tabular-nums">{health.retrying}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <Inbox className={cn('h-6 w-6', health.dead ? 'text-destructive' : 'text-success')} />
          <div>
            <p className="text-sm text-muted-foreground">Dead letters</p>
            <p className="text-xl font-bold tabular-nums">{health.dead}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.services.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-semibold">Broker queues</h2>
          <span className="text-xs text-muted-foreground">Checked {new Date(data.checkedAt).toLocaleTimeString()}</span>
        </div>
        {data.queuesError ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{data.queuesError}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Queue</th>
                  <th className="px-4 py-2 text-right font-medium">Ready</th>
                  <th className="px-4 py-2 text-right font-medium">In progress</th>
                  <th className="px-4 py-2 text-right font-medium">Consumers</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.queues.map((queue) => (
                  <tr key={queue.name}>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{queue.name}</span>
                      {queue.kind !== 'main' ? (
                        <Badge variant={queue.kind === 'dead' ? (queue.ready ? 'destructive' : 'outline') : 'secondary'} className="ml-2">
                          {queue.kind}
                        </Badge>
                      ) : null}
                    </td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', queue.kind === 'dead' && queue.ready && 'font-semibold text-destructive')}>{queue.ready}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{queue.unacked}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', queue.kind === 'main' && !queue.consumers && 'font-semibold text-warning')}>{queue.consumers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { AccountStatus } from '@appenglish/auth-contracts';
import { ChartContainer, ChartTooltip } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';

const series = 'hsl(var(--chart-1))';
export const statusTone = {
  [AccountStatus.ACTIVE]: 'bg-success',
  [AccountStatus.PENDING_VERIFICATION]: 'bg-info',
  [AccountStatus.SUSPENDED]: 'bg-warning',
  [AccountStatus.DISABLED]: 'bg-destructive',
};

export function Tile({ icon: Icon, label, value, detail, tone = 'bg-primary/10 text-primary' }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
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

const utcDate = (day) => new Date(`${day}T00:00:00Z`);
export const shortDay = (day) => utcDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = (day) => utcDate(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function SignupsChart({ points }) {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  return (
    <ChartContainer
      config={{ count: { label: 'Sign-ups', color: series } }}
      className="aspect-auto h-56 w-full"
      role="img"
      aria-label={`Sign-ups per day over ${points.length} days, ${total} in total`}
    >
      <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="signups-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval={6} tickMargin={8} tickFormatter={shortDay} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
        <ChartTooltip
          cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
          content={({ active, payload }) => {
            const point = active ? payload?.[0]?.payload : null;
            if (!point) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                <p className="font-medium">{longDay(point.day)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-(--color-count)" aria-hidden="true" />
                  <span className="font-semibold tabular-nums text-foreground">{point.count}</span> sign-up{point.count === 1 ? '' : 's'}
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-count)"
          strokeWidth={2}
          fill="url(#signups-fill)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))', fill: 'var(--color-count)' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function StatusBreakdown({ rows }) {
  const shown = rows.filter((row) => row.count > 0);
  return (
    <div className="space-y-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {shown.map((row) => (
          <div key={row.status} className={cn('h-full first:rounded-l-full last:rounded-r-full', statusTone[row.status])} style={{ width: `${row.percent}%`, minWidth: '4px' }} />
        ))}
      </div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.status}>
            <Link to={`/admin/accounts?status=${row.status}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/60">
              <span className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', statusTone[row.status])} aria-hidden="true" />
                {row.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{row.count}</span>
                <span className="ml-2 inline-block w-10 text-right">{row.percent}%</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

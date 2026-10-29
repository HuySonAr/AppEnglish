import { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { getLeaderboard } from '../api/progress-api.js';
import { filterLeaderboard, pageOfRank } from '../lib/leaderboard.js';
import { useListState } from '../../../hooks/use-list-state.js';

const PAGE_SIZE = 10;
const medals = {
  1: 'bg-warning text-white',
  2: 'bg-slate-400 text-white',
  3: 'bg-orange-700/80 text-white',
};
const tests = (count) => `${count} mock test${count === 1 ? '' : 's'}`;

function PodiumPlace({ entry }) {
  const first = entry.rank === 1;
  return (
    <li className={cn('flex flex-col items-center gap-1 text-center', first ? 'order-2' : entry.rank === 2 ? 'order-1 sm:mt-8' : 'order-3 sm:mt-8')}>
      <span className="relative">
        <Avatar account={entry} size="lg" className={cn('shadow-xs', first ? 'h-24 w-24' : 'h-16 w-16 text-2xl', entry.isYou && 'ring-2 ring-primary ring-offset-2 ring-offset-card')} />
        <span className={cn('absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card', medals[entry.rank])} aria-label={`Rank ${entry.rank}`}>
          {first ? <Crown className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">{entry.rank}</span>}
        </span>
      </span>
      <p className={cn('mt-2 max-w-40 truncate font-semibold', first ? 'text-lg' : 'text-base')}>{entry.displayName || 'Learner'}</p>
      {entry.isYou ? <Badge variant="info">You</Badge> : null}
      <p className="text-sm text-muted-foreground">{tests(entry.mockCount)}</p>
      <p className="flex items-center gap-1 font-semibold tabular-nums">
        <Trophy className="h-4 w-4 text-warning" aria-hidden="true" />
        {entry.totalXp} XP
      </p>
    </li>
  );
}

function RankRow({ entry }) {
  return (
    <li className={cn('flex items-center gap-4 rounded-xl px-3 py-2.5', entry.isYou && 'bg-primary/10')} aria-current={entry.isYou ? 'true' : undefined}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-sm font-medium tabular-nums">{entry.rank}</span>
      <Avatar account={entry} size="sm" />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">{entry.displayName || 'Learner'}</span>
        {entry.isYou ? <Badge variant="info">You</Badge> : null}
      </span>
      <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">{tests(entry.mockCount)}</span>
      <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-muted-foreground/50 sm:inline-block" />
      <span className="w-16 text-right font-semibold tabular-nums">{entry.totalXp} XP</span>
    </li>
  );
}

export function LeaderboardPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const { filters, setFilter, page, setPage } = useListState({ search: '' });
  const search = filters.search;
  const setSearch = setFilter('search');

  async function load() {
    setState('loading');
    try {
      setData((await getLeaderboard()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the leaderboard', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const header = <PageHeader eyebrow="Mock tests" title="Leaderboard" description="Total XP from mock tests." />;
  const takeTest = (
    <Button asChild variant="outline" className="rounded-full">
      <Link to="/student/mock-tests">Take a mock test</Link>
    </Button>
  );

  if (state === 'loading') return <ListPageSkeleton rows={8} />;
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  if (!data.entries.length)
    return (
      <section className="space-y-6">
        {header}
        <EmptyState icon={Trophy} title="No XP yet" description="Finish a full mock test to open the board." action={takeTest} />
      </section>
    );

  const searching = Boolean(search.trim());
  const podium = searching ? [] : data.entries.slice(0, 3);
  const rest = searching ? filterLeaderboard(data.entries, { search }) : data.entries.slice(3);
  const shown = paginate(rest, page, PAGE_SIZE);
  const youInRest = data.you && data.you.rank > 3 && data.entries.some((entry) => entry.isYou);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {header}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 className="text-xl font-bold">Top learners</h2>
            <p className="text-sm text-muted-foreground">Ranked by total XP.</p>
          </div>
          {takeTest}
        </div>

        {podium.length ? (
          <ol className="grid grid-cols-3 items-start gap-2 px-4 pb-6 pt-8 sm:px-8" aria-label="Top three">
            {podium.map((entry) => (
              <PodiumPlace key={entry.accountId} entry={entry} />
            ))}
          </ol>
        ) : null}

        <div className="space-y-3 px-3 pb-3">
          <SearchField
            label="Search learners"
            placeholder="Search by name…"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          {rest.length ? (
            <ol className="space-y-1 rounded-2xl bg-muted/50 p-2">
              {shown.items.map((entry) => (
                <RankRow key={entry.accountId} entry={entry} />
              ))}
            </ol>
          ) : searching ? (
            <EmptyState icon={Trophy} title="No learner matches" description="Try another name." />
          ) : null}
        </div>
      </div>

      {rest.length ? <Pagination page={shown.page} pageCount={shown.pageCount} total={rest.length} noun="learner" onChange={setPage} /> : null}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <Trophy className="h-5 w-5" />
        </span>
        <p className="flex-1 font-medium">
          {data.you ? (
            <>
              Your place: <span className="tabular-nums">#{data.you.rank}</span> of {data.learnerCount} · <span className="tabular-nums">{data.you.totalXp} XP</span>
            </>
          ) : (
            'Finish a full mock test to join the board.'
          )}
        </p>
        {youInRest && !searching ? (
          <Button variant="ghost" size="sm" onClick={() => setPage(pageOfRank(data.you.rank - 3, PAGE_SIZE))}>
            Show my row
          </Button>
        ) : null}
      </div>
      {data.learnerCount > data.entries.length ? <p className="text-center text-xs text-muted-foreground">Top {data.entries.length} of {data.learnerCount} learners.</p> : null}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
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

const PAGE_SIZE = 10;
const medal = { 1: 'text-warning', 2: 'text-muted-foreground', 3: 'text-warning/70' };

// The XP leaderboard (F07, D39): one overall board of total XP from mock
// tests, ties broken by who reached the total first. The learner's own row
// is highlighted; below the top the learner still sees their place.
export function LeaderboardPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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

  const header = <PageHeader eyebrow="Mock tests" title="Leaderboard" description="Total XP from mock tests. Only the first full attempt of each test earns XP: right answers out of 100." />;

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
        <EmptyState
          icon={Trophy}
          title="No XP yet"
          description="The first learner to finish a full mock test opens the board."
          action={
            <Button asChild>
              <Link to="/student/mock-tests">Take a mock test</Link>
            </Button>
          }
        />
      </section>
    );

  const filtered = filterLeaderboard(data.entries, { search });
  const shown = paginate(filtered, page, PAGE_SIZE);
  const youShown = data.you && data.entries.some((entry) => entry.isYou);

  return (
    <section className="space-y-6">
      {header}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">Your place</p>
            <p className="font-semibold">
              {data.you ? `#${data.you.rank} of ${data.learnerCount} · ${data.you.totalXp} XP` : 'No XP yet: finish a full mock test to join the board.'}
            </p>
          </div>
        </div>
        {youShown && !search ? (
          <Button variant="outline" size="sm" onClick={() => setPage(pageOfRank(data.you.rank, PAGE_SIZE))}>
            Show my row
          </Button>
        ) : null}
      </div>

      <SearchField
        label="Search learners"
        placeholder="Search by name…"
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Trophy} title="No learner matches" description="Try another name." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="grid grid-cols-[3rem_1fr_6rem] gap-3 border-b bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground sm:grid-cols-[3rem_1fr_7rem_6rem]">
            <span>#</span>
            <span>Learner</span>
            <span className="hidden text-right sm:block">Mock tests</span>
            <span className="text-right">XP</span>
          </div>
          <ol className="divide-y">
            {shown.items.map((entry) => (
              <li
                key={entry.accountId}
                className={cn('grid grid-cols-[3rem_1fr_6rem] items-center gap-3 px-4 py-3 sm:grid-cols-[3rem_1fr_7rem_6rem]', entry.isYou && 'bg-primary/5')}
                aria-current={entry.isYou ? 'true' : undefined}
              >
                <span className="flex items-center gap-1 font-semibold tabular-nums">
                  {entry.rank <= 3 ? <Medal className={cn('h-4 w-4', medal[entry.rank])} aria-hidden="true" /> : null}
                  {entry.rank}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar account={entry} size="sm" />
                  <span className="truncate">{entry.displayName || 'Learner'}</span>
                  {entry.isYou ? <Badge variant="info">You</Badge> : null}
                </span>
                <span className="hidden text-right text-sm text-muted-foreground tabular-nums sm:block">{entry.mockCount}</span>
                <span className="text-right font-semibold tabular-nums">{entry.totalXp}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Pagination page={shown.page} pageCount={shown.pageCount} total={filtered.length} noun="learner" onChange={setPage} />
      {data.learnerCount > data.entries.length ? (
        <p className="text-xs text-muted-foreground">
          Showing the top {data.entries.length} of {data.learnerCount} learners.
        </p>
      ) : null}
    </section>
  );
}

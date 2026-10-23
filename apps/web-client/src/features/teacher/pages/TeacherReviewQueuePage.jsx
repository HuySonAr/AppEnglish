import { useEffect, useState } from 'react';
import { ClipboardCheck, Mic, PenLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { notify } from '../../../lib/notify.js';
import { timeAgo } from '../../../lib/notifications.js';
import { paginate } from '../../../lib/list.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { claimReview, listReviewQueue } from '../api/review-api.js';
import { hoursLeft, reviewKindLabels } from '../lib/review.js';

const PAGE_SIZE = 15;
const DEFAULTS = { kind: 'all', ai: 'all' };
const kindOptions = [{ value: 'all', label: 'All kinds' }, ...Object.entries(reviewKindLabels).map(([value, label]) => ({ value, label }))];
const aiOptions = [
  { value: 'all', label: 'With or without AI score' },
  { value: 'yes', label: 'Has an AI score' },
  { value: 'no', label: 'No AI score' },
];

export function TeacherReviewQueuePage() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [taking, setTaking] = useState(null);
  const { filters, setFilter, page, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      setData((await listReviewQueue()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the queue', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function take(item) {
    if (item.mine) return navigate(`/teacher/reviews/${item.id}`);
    setTaking(item.id);
    try {
      await claimReview(item.id);
      navigate(`/teacher/reviews/${item.id}`);
    } catch (error) {
      notify({ title: errorCode(error) === LearningResponseCode.REVIEW_LOCKED ? 'Another teacher took it first' : 'Could not take this answer', description: getApiErrorMessage(error), variant: 'destructive' });
      setTaking(null);
      load();
    }
  }

  const header = <PageHeader eyebrow="Teacher" title="Grading" description="Take the oldest answer first." />;
  if (state === 'loading')
    return (
      <section className="space-y-6">
        {header}
        <RowsSkeleton rows={6} />
      </section>
    );
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const filtered = data.reviews.filter((item) => (filters.kind === 'all' || item.kind === filters.kind) && (filters.ai === 'all' || item.hasAi === (filters.ai === 'yes')));
  const shown = paginate(filtered, page, PAGE_SIZE);

  return (
    <section className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Waiting</p>
          <p className="text-2xl font-bold tabular-nums">{data.reviews.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Graded this week</p>
          <p className="text-2xl font-bold tabular-nums">{data.doneThisWeek}</p>
        </div>
      </div>
      {data.reviews.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to grade" description="New answers appear here when learners send them." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row">
              <FilterSelect label="Kind" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} className="w-full sm:w-44" />
              <FilterSelect label="AI score" value={filters.ai} onChange={setFilter('ai')} options={aiOptions} className="w-full sm:w-56" />
            </div>
            {shown.total === 0 ? (
              <div className="p-6">
                <EmptyState icon={ClipboardCheck} title="No answer matches" description="Try another filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{item.kind === 'writing' ? <PenLine className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.title || 'Untitled prompt'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {reviewKindLabels[item.kind]} · {item.level} · sent {timeAgo(item.requestedAt)} · {hoursLeft(item.expiresAt)} h left
                      </span>
                    </span>
                    <span className="hidden shrink-0 gap-1.5 sm:flex">
                      {item.mine ? <Badge variant="info">Yours</Badge> : null}
                      <Badge variant={item.hasAi ? 'secondary' : 'outline'}>{item.hasAi ? 'AI score' : 'No AI score'}</Badge>
                    </span>
                    <Button size="sm" variant={item.mine ? 'default' : 'outline'} loading={taking === item.id} disabled={Boolean(taking)} onClick={() => take(item)}>
                      {item.mine ? 'Continue' : 'Take'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="answer" onChange={setPage} />
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ChevronRight, ClipboardCheck, FileText, Headphones, Inbox, Library, ListChecks, MicVocal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentReviewKind, LessonVersionStatus } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { timeAgo } from '../../../lib/notifications.js';
import { paginate } from '../../../lib/list.js';
import { Badge, Button, Tabs, TabsList, TabsTrigger } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { listContentReviews } from '../api/content-api.js';
import { ReviewStatusBadge } from '../components/ContentReview.jsx';
import {
  MANAGER_BASE,
  ReviewSort,
  ReviewTab,
  contentItemPath,
  filterReviews,
  reviewDateOf,
  reviewKindLabels,
  reviewSortOptions,
  reviewTabCounts,
  reviewTitle,
} from '../lib/content-area.js';

const PAGE_SIZE = 15;
const DEFAULTS = { tab: ReviewTab.WAITING, search: '', sort: ReviewSort.NEWEST };
const tabs = [
  { value: ReviewTab.WAITING, label: 'Waiting for review' },
  { value: ReviewTab.RETURNED, label: 'Returned' },
  { value: ReviewTab.DRAFTS, label: 'Drafts' },
];
const kindIcons = {
  [ContentReviewKind.LESSON]: Library,
  [ContentReviewKind.UNIT_REVIEW]: ListChecks,
  [ContentReviewKind.PLACEMENT]: ClipboardCheck,
  [ContentReviewKind.MOCK_TEST]: FileText,
  [ContentReviewKind.LISTENING_EXERCISE]: Headphones,
  [ContentReviewKind.SW_TEST]: MicVocal,
};
const emptyText = {
  [ReviewTab.WAITING]: { title: 'Nothing waiting for review', description: 'Submitted content appears here.' },
  [ReviewTab.RETURNED]: { title: 'Nothing returned', description: 'Content you return appears here until it is sent again.' },
  [ReviewTab.DRAFTS]: { title: 'No drafts', description: 'Content teachers are writing appears here.' },
};

function personOf(item) {
  if (item.status === LessonVersionStatus.PENDING_REVIEW) return { verb: 'Sent by', account: item.submitter || item.editor };
  return { verb: 'Edited by', account: item.editor || item.submitter };
}

function ReviewRow({ item }) {
  const Icon = kindIcons[item.kind] || FileText;
  const { verb, account } = personOf(item);
  const when = reviewDateOf(item);
  return (
    <li>
      <Link
        to={contentItemPath(MANAGER_BASE, item.kind, item.id)}
        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate font-medium">
            {reviewTitle(item)}
            {item.context ? <span className="font-normal text-muted-foreground"> · {item.context}</span> : null}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>
              {reviewKindLabels[item.kind]} · v{item.versionNumber}
            </span>
            {account ? (
              <span className="flex items-center gap-1">
                · {verb}
                <Avatar account={account} className="h-4 w-4 text-[9px]" />
                <span className="font-medium text-foreground">{account.displayName || 'Unknown'}</span>
              </span>
            ) : null}
            {when ? <span>· {timeAgo(when)}</span> : null}
          </span>
          {item.status === LessonVersionStatus.RETURNED && item.reviewNote ? <span className="block truncate text-xs text-muted-foreground">Note: {item.reviewNote}</span> : null}
        </span>
        <span className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
          {item.live ? <Badge variant="success">Live</Badge> : <Badge variant="outline">New</Badge>}
          <ReviewStatusBadge status={item.status} />
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export function ContentReviewQueuePage() {
  const [state, setState] = useState('loading');
  const [items, setItems] = useState([]);
  const { filters, setFilter, setFilters, page, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      setItems((await listContentReviews()).data.items);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the review queue', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const header = <PageHeader eyebrow="Content Manager" title="Review queue" description="Open an item to approve it or return it with a note." />;
  if (state === 'loading') return <ListPageSkeleton rows={6} />;
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const counts = reviewTabCounts(items);
  const tab = counts[filters.tab] === undefined ? ReviewTab.WAITING : filters.tab;
  const shown = paginate(filterReviews(items, { ...filters, tab }), page, PAGE_SIZE);
  const empty = emptyText[tab];

  return (
    <section className="space-y-6">
      {header}

      <Tabs value={tab} onValueChange={(value) => setFilters((current) => ({ ...current, tab: value }))}>
        <TabsList className="h-auto flex-wrap justify-start">
          {tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label} ({counts[item.value]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {counts[tab] === 0 ? (
        <EmptyState icon={Inbox} title={empty.title} description={empty.description} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row sm:items-center">
              <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title" />
              <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={reviewSortOptions} className="w-full sm:w-40" />
            </div>
            {shown.total === 0 ? (
              <div className="p-6">
                <EmptyState icon={Inbox} title="Nothing matches" description="Try another search." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((item) => (
                  <ReviewRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </div>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="item" onChange={setPage} />
        </div>
      )}
    </section>
  );
}

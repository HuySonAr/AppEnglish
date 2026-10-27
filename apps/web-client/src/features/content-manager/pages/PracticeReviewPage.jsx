import { useEffect, useState } from 'react';
import { ChevronRight, Mic, PenLine, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { Badge, Button, Tabs, TabsList, TabsTrigger } from '../../../components/ui';
import { Avatar } from '../../../components/shared/Avatar.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { timeAgo } from '../../../lib/notifications.js';
import { listPracticePrompts } from '../../../lib/api/practice-prompts-api.js';
import { ReviewArea, authorOptions, etsTaskLabel, etsTaskOf, etsTaskOptions, filterPrompts, kindLabels, levelOptions, reviewAreaKinds, reviewPromptPath, statusInfo } from '../../../lib/practice-prompts.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', kind: 'all', etsTask: 'all', level: 'all', status: 'PENDING_REVIEW', author: 'all' };
const statusTabs = [
  { value: 'PENDING_REVIEW', label: 'Waiting' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'UNPUBLISHED', label: 'Taken down' },
  { value: 'all', label: 'All' },
];
const areas = {
  [ReviewArea.SPEAKING]: { title: 'Speaking prompts', description: 'Review read-aloud and open speaking prompts from teachers.', icon: Mic },
  [ReviewArea.WRITING]: { title: 'Writing prompts', description: 'Review writing prompts from teachers.', icon: PenLine },
};

const waitingFirst = (a, b) => (a.status === 'PENDING_REVIEW') === (b.status === 'PENDING_REVIEW') ? String(b.updatedAt).localeCompare(String(a.updatedAt)) : a.status === 'PENDING_REVIEW' ? -1 : 1;

export function PracticeReviewPage({ area }) {
  const page = areas[area];
  const kinds = reviewAreaKinds[area];
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);
  const { filters, setFilters, setFilter, page: pageNumber, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      setPrompts((await listPracticePrompts()).data.prompts.filter((prompt) => kinds.includes(prompt.kind)).map((prompt) => ({ ...prompt, etsTask: etsTaskOf(prompt.kind, prompt) })));
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [area]);

  const filtered = filterPrompts(prompts, filters).filter((prompt) => filters.author === 'all' || prompt.authorId === filters.author);
  const shown = paginate([...filtered].sort(waitingFirst), pageNumber, PAGE_SIZE);
  const narrowed = Object.entries(DEFAULTS).some(([key, value]) => key !== 'status' && filters[key] !== value);
  const countOf = (status) => (status === 'all' ? prompts.length : prompts.filter((prompt) => prompt.status === status).length);
  const kindOptions = [{ value: 'all', label: 'All kinds' }, ...kinds.map((kind) => ({ value: kind, label: kindLabels[kind] }))];

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Content Manager" title={page.title} description={page.description} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : prompts.length === 0 ? (
        <EmptyState icon={page.icon} title="No prompts yet" description="Prompts appear here when teachers send them." />
      ) : (
        <div className="space-y-4">
          <Tabs value={filters.status} onValueChange={setFilter('status')}>
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList aria-label="State" className="h-auto justify-start">
                {statusTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                    <span className={tab.value === 'PENDING_REVIEW' && countOf(tab.value) ? 'ml-1.5 rounded-full bg-primary px-1.5 text-xs tabular-nums text-primary-foreground' : 'ml-1.5 tabular-nums text-muted-foreground'}>{countOf(tab.value)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="space-y-3 border-b bg-muted/30 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
                <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title or topic" />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <FilterSelect label="Teacher" value={filters.author} onChange={setFilter('author')} options={authorOptions(prompts)} className="w-full sm:w-44" />
                  {kinds.length > 1 ? <FilterSelect label="Kind" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} className="w-full sm:w-40" /> : null}
                  <FilterSelect label="Task type" value={filters.etsTask} onChange={setFilter('etsTask')} options={etsTaskOptions(prompts)} className="w-full sm:w-52" />
                  <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-32" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {shown.total} prompt{shown.total === 1 ? '' : 's'}
                </span>
                {narrowed ? (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setFilters({ ...DEFAULTS, status: filters.status })}>
                    <X className="h-3.5 w-3.5" />
                    Reset filters
                  </Button>
                ) : null}
              </div>
            </div>
            {shown.total === 0 ? (
              <div className="p-6">
                <EmptyState icon={page.icon} title={filters.status === 'PENDING_REVIEW' && !filters.search ? 'Nothing to review' : 'No prompt matches'} description="Try another search or filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((prompt) => (
                  <li key={prompt.id}>
                    <Link
                      to={reviewPromptPath(prompt.kind, prompt.id)}
                      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">{prompt.level || '—'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{prompt.title || 'Untitled prompt'}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {etsTaskLabel(prompt.etsTask, kindLabels[prompt.kind])}
                          {prompt.topic ? ` · ${prompt.topic}` : ''} · version {prompt.versionNumber}
                          {prompt.submittedAt && prompt.status === 'PENDING_REVIEW' ? ` · sent ${timeAgo(prompt.submittedAt)}` : ''}
                        </span>
                      </span>
                      <span className="hidden w-40 shrink-0 items-center gap-2 md:flex">
                        <Avatar account={prompt.author} size="sm" />
                        <span className="truncate text-sm">{prompt.author?.displayName || 'Unknown teacher'}</span>
                      </span>
                      <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {prompt.publishedVersionNumber && prompt.status !== 'PUBLISHED' ? <Badge variant="success">Live v{prompt.publishedVersionNumber}</Badge> : null}
                        {!prompt.etsTask ? <Badge variant="outline">No task type</Badge> : null}
                        <Badge variant={statusInfo[prompt.status].variant}>{statusInfo[prompt.status].label}</Badge>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="prompt" onChange={setPage} />
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ChevronRight, MicVocal, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LessonVersionStatus, SW_SPEAKING_LAYOUT, SW_WRITING_LAYOUT } from '@appenglish/content-contracts';
import { ReviewStatusBadge } from '../components/ContentReview.jsx';
import { useContentArea } from '../hooks/use-content-area.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { paginate } from '../../../lib/list.js';
import { useListState } from '../../../hooks/use-list-state.js';
import { useFocusReturn, useListLinkState } from '../../../hooks/use-return-to.js';
import { StatusFilter, SwSort, filterSwTests, statusOptions, swSortOptions } from '../lib/content-list.js';
import { createSwTest, listSwTests } from '../api/content-api.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', status: StatusFilter.ALL, sort: SwSort.NEWEST };
const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function NewSwTestDialog({ open, onOpenChange, base }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTitle('');
  }, [open]);

  async function onCreate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createSwTest({ title: title.trim() });
      notify({ title: 'S&W test created' });
      navigate(`${base}/sw-tests/${result.data.swTest.id}`);
    } catch (error) {
      notify({ title: 'Could not create the test', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onCreate} className="space-y-5">
          <DialogHeader>
            <DialogTitle>New S&W test</DialogTitle>
            <DialogDescription>Write the questions on the next page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sw-title">Title</Label>
            <Input id="sw-title" autoFocus value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={busy || !title.trim()}>
              Create and open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SwTestRow({ test, base, linkState }) {
  return (
    <li id={`focus-${test.id}`}>
      <Link
        to={`${base}/sw-tests/${test.id}`}
        state={linkState(test.id)}
        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MicVocal className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{test.title}</span>
          <span className="block text-xs text-muted-foreground">
            Speaking {SW_SPEAKING_LAYOUT.total} · Writing {SW_WRITING_LAYOUT.total}
            {test.createdAt ? ` · created ${dateText(test.createdAt)}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {test.hasDraft ? <ReviewStatusBadge status={test.draftStatus || LessonVersionStatus.DRAFT} /> : null}
          {test.publishedVersionNumber ? <Badge variant="success">Published v{test.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export function SwTestsManagePage() {
  const { base, eyebrow, canAuthor } = useContentArea();
  const [state, setState] = useState('loading');
  const [tests, setTests] = useState([]);
  const [creating, setCreating] = useState(false);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);
  const linkState = useListLinkState();
  useFocusReturn(state === 'ready');

  async function load() {
    setState('loading');
    try {
      setTests((await listSwTests()).data.swTests);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the S&W tests', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = paginate(filterSwTests(tests, filters), page, PAGE_SIZE);
  const narrowed = filters.search || filters.status !== StatusFilter.ALL;
  const newButton = canAuthor ? (
    <Button className="gap-2" disabled={state !== 'ready'} onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      New S&W test
    </Button>
  ) : null;

  return (
    <section className="space-y-6">
      <PageHeader eyebrow={eyebrow} title="S&W tests" description="Speaking and Writing tests in the real exam order." actions={newButton} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : tests.length === 0 ? (
        <EmptyState icon={MicVocal} title="No S&W tests yet" description={canAuthor ? 'Create the first test.' : 'Tests appear here once teachers create them.'} action={newButton} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="space-y-3 border-b bg-muted/30 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title" />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <FilterSelect label="Status" value={filters.status} onChange={setFilter('status')} options={statusOptions} className="w-full sm:w-40" />
                  <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={swSortOptions} className="w-full sm:w-40" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {shown.total} test{shown.total === 1 ? '' : 's'}
                </span>
                {narrowed ? (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setFilters((current) => ({ ...DEFAULTS, sort: current.sort }))}>
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>
            {shown.total === 0 ? (
              <div className="p-6">
                <EmptyState icon={MicVocal} title="No test matches" description="Try another search or filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((test) => (
                  <SwTestRow key={test.id} test={test} base={base} linkState={linkState} />
                ))}
              </ul>
            )}
          </div>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="test" onChange={setPage} />
        </div>
      )}

      {canAuthor ? <NewSwTestDialog open={creating} onOpenChange={setCreating} base={base} /> : null}
    </section>
  );
}

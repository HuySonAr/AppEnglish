import { useEffect, useState } from 'react';
import { ChevronRight, Clock, FileText, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LessonVersionStatus, MOCK_TEST_DURATION_MINUTES, MOCK_TEST_LEVELS, MockFormat } from '@appenglish/content-contracts';
import { ReviewStatusBadge } from '../components/ContentReview.jsx';
import { MockFormatBadge, formatOf, mockFormatLabels as formatLabels } from '../components/MockFormatBadge.jsx';
import { useContentArea } from '../hooks/use-content-area.js';
import { listExamTypes } from '../../../lib/api/exam-types-api.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { paginate } from '../../../lib/list.js';
import { MockSort, StatusFilter, filterMockTests, mockSortOptions, statusOptions } from '../lib/content-list.js';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { createMockTest, listMockTests } from '../api/content-api.js';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useListState } from '../../../hooks/use-list-state.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', examType: 'all', level: 'all', status: StatusFilter.ALL, sort: MockSort.LEVEL };
const PRACTICE_MINUTES = 60;
const levelOptions = [{ value: 'all', label: 'All levels' }, ...MOCK_TEST_LEVELS.map((level) => ({ value: String(level), label: `Level ${level}` }))];

function ChoiceButton({ selected, onClick, className, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
        className,
      )}
    >
      {children}
    </button>
  );
}

function NewMockTestDialog({ open, onOpenChange, examTypes, base }) {
  const navigate = useNavigate();
  const writable = examTypes.filter((type) => type.hasEditor);
  const [form, setForm] = useState({ title: '', examTypeId: '', level: '1', format: MockFormat.FULL, durationMinutes: String(PRACTICE_MINUTES) });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm({ title: '', examTypeId: writable[0]?.id || '', level: '1', format: MockFormat.FULL, durationMinutes: String(PRACTICE_MINUTES) });
  }, [open]);

  const full = form.format === MockFormat.FULL;
  const minutes = Number(form.durationMinutes);
  const valid = form.title.trim() && form.examTypeId && (full || (Number.isInteger(minutes) && minutes >= 1 && minutes <= 300));

  async function onCreate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createMockTest({
        title: form.title.trim(),
        examTypeId: form.examTypeId,
        level: Number(form.level),
        format: form.format,
        ...(full ? {} : { durationMinutes: minutes }),
      });
      notify({ title: 'Mock test created' });
      navigate(`${base}/mock-tests/${result.data.mockTest.id}`);
    } catch (error) {
      notify({ title: 'Could not create the mock test', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onCreate} className="space-y-5">
          <DialogHeader>
            <DialogTitle>New mock test</DialogTitle>
            <DialogDescription>Write the questions on the next page.</DialogDescription>
          </DialogHeader>

          {writable.length > 1 ? (
            <div className="space-y-2">
              <Label>Exam type</Label>
              <div className="flex flex-wrap gap-1.5">
                {writable.map((type) => (
                  <ChoiceButton key={type.id} className="h-9" selected={form.examTypeId === type.id} onClick={() => setForm({ ...form, examTypeId: type.id })}>
                    {type.name}
                  </ChoiceButton>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {[MockFormat.FULL, MockFormat.PRACTICE].map((format) => (
                <ChoiceButton key={format} className="h-10" selected={form.format === format} onClick={() => setForm({ ...form, format })}>
                  {formatLabels[format]}
                </ChoiceButton>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {full ? `200 questions in the exam layout, ${MOCK_TEST_DURATION_MINUTES} minutes.` : 'Any number of questions per part, your own time limit.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mock-title">Title</Label>
            <Input id="mock-title" autoFocus value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>

          <div className="flex flex-wrap gap-5">
            <div className="space-y-2">
              <Label>Level</Label>
              <div className="flex gap-1.5">
                {MOCK_TEST_LEVELS.map((level) => (
                  <ChoiceButton key={level} className="h-10 min-w-11 tabular-nums" selected={form.level === String(level)} onClick={() => setForm({ ...form, level: String(level) })}>
                    {level}
                  </ChoiceButton>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mock-minutes">Minutes</Label>
              {full ? (
                <Input id="mock-minutes" className="w-24" value={String(MOCK_TEST_DURATION_MINUTES)} disabled readOnly />
              ) : (
                <Input id="mock-minutes" className="w-24" inputMode="numeric" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value.trim() })} />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={busy || !valid}>
              Create and open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MockTestRow({ mockTest, base }) {
  return (
    <li>
      <Link
        to={`${base}/mock-tests/${mockTest.id}`}
        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-muted leading-none">
          <span className="text-[10px] uppercase text-muted-foreground">Level</span>
          <span className="text-sm font-semibold tabular-nums">{mockTest.level}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{mockTest.title}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {mockTest.examType ? <span>{mockTest.examType.name}</span> : null}
            {mockTest.examType ? <span aria-hidden="true">·</span> : null}
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{mockTest.durationMinutes} min</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <MockFormatBadge format={formatOf(mockTest)} />
          {mockTest.hasDraft ? <ReviewStatusBadge status={mockTest.draftStatus || LessonVersionStatus.DRAFT} /> : null}
          {mockTest.publishedVersionNumber ? <Badge variant="success">Published v{mockTest.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export function MockTestsManagePage() {
  const { base, eyebrow, canAuthor } = useContentArea();
  const [state, setState] = useState('loading');
  const [mockTests, setMockTests] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [creating, setCreating] = useState(false);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      const [tests, types] = await Promise.all([listMockTests(), listExamTypes()]);
      setMockTests(tests.data.mockTests);
      setExamTypes(types.data.examTypes);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the mock tests', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = paginate(filterMockTests(mockTests, filters), page, PAGE_SIZE);
  const examTypeOptions = [{ value: 'all', label: 'All exam types' }, ...examTypes.map((type) => ({ value: type.id, label: type.name }))];
  const narrowed = filters.search || filters.examType !== 'all' || filters.level !== 'all' || filters.status !== StatusFilter.ALL;
  const canCreate = state === 'ready' && examTypes.some((type) => type.hasEditor);
  const newButton = canAuthor ? (
    <Button className="gap-2" disabled={!canCreate} onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      New mock test
    </Button>
  ) : null;

  return (
    <section className="space-y-6">
      <PageHeader eyebrow={eyebrow} title="Mock tests" description="Full TOEIC-style tests, also taken one part at a time." actions={newButton} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : mockTests.length === 0 ? (
        <EmptyState icon={FileText} title="No mock tests yet" description={canAuthor ? 'Create the first mock test.' : 'Mock tests appear here once teachers create them.'} action={newButton} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="space-y-3 border-b bg-muted/30 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title" />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {examTypes.length > 1 ? <FilterSelect label="Exam type" value={filters.examType} onChange={setFilter('examType')} options={examTypeOptions} className="w-full sm:w-40" /> : null}
                  <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-32" />
                  <FilterSelect label="Status" value={filters.status} onChange={setFilter('status')} options={statusOptions} className="w-full sm:w-40" />
                  <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={mockSortOptions} className="w-full sm:w-40" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {shown.total} mock test{shown.total === 1 ? '' : 's'}
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
                <EmptyState icon={FileText} title="No mock test matches" description="Try another search or filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((mockTest) => (
                  <MockTestRow key={mockTest.id} mockTest={mockTest} base={base} />
                ))}
              </ul>
            )}
          </div>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="mock test" onChange={setPage} />
        </div>
      )}

      {canAuthor ? <NewMockTestDialog open={creating} onOpenChange={setCreating} examTypes={examTypes} base={base} /> : null}
    </section>
  );
}

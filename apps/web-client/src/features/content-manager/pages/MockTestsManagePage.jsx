import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MOCK_TEST_DURATION_MINUTES, MOCK_TEST_LEVELS } from '@appenglish/content-contracts';
import { listExamTypes } from '../../../lib/api/exam-types-api.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { paginate } from '../../../lib/list.js';
import {
  MockSort,
  StatusFilter,
  filterMockTests,
  mockSortOptions,
  statusOptions,
} from '../lib/content-list.js';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { createMockTest, listMockTests } from '../api/content-api.js';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';

const PAGE_SIZE = 10;
const levelOptions = [
  { value: 'all', label: 'All levels' },
  ...MOCK_TEST_LEVELS.map((level) => ({ value: String(level), label: `Level ${level}` })),
];

// Mock tests: the list (searched, filtered, sorted and paged) and the form to add one. Questions are written on the
// mock test's own page.
export function MockTestsManagePage() {
  const [state, setState] = useState('loading');
  const [mockTests, setMockTests] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [form, setForm] = useState({ title: '', examTypeId: '', level: '1', durationMinutes: String(MOCK_TEST_DURATION_MINUTES) });
  const [busy, setBusy] = useState(false);
  // Search, filters and sort of the list; changing one goes back to page 1.
  const [filters, setFilters] = useState({ search: '', examType: 'all', level: 'all', status: StatusFilter.ALL, sort: MockSort.LEVEL });
  const [page, setPage] = useState(1);
  const setFilter = (name) => (value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  async function load() {
    setState('loading');
    try {
      const [tests, types] = await Promise.all([listMockTests(), listExamTypes()]);
      setMockTests(tests.data.mockTests);
      setExamTypes(types.data.examTypes);
      // A new test is for the first exam type that has an editor (TOEIC).
      setForm((current) => ({
        ...current,
        examTypeId: current.examTypeId || types.data.examTypes.find((type) => type.hasEditor)?.id || '',
      }));
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
  const minutes = Number(form.durationMinutes);
  const valid = form.title.trim() && form.examTypeId && Number.isInteger(minutes) && minutes >= 1 && minutes <= 300;
  const examTypeOptions = [
    { value: 'all', label: 'All exam types' },
    ...examTypes.map((type) => ({ value: type.id, label: type.name })),
  ];

  async function onCreate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await createMockTest({ title: form.title.trim(), examTypeId: form.examTypeId, level: Number(form.level), durationMinutes: minutes });
      setForm({ ...form, title: '' });
      notify({ title: 'Mock test created' });
      await load();
    } catch (error) {
      notify({ title: 'Could not create the mock test', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Mock tests"
        description="Full TOEIC-style tests. Learners take a mock test in full, or one part at a time as a mini test."
      />

      <form onSubmit={onCreate} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_10rem_8rem_8rem_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="mock-title">New mock test title</Label>
          <Input id="mock-title" value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-exam-type">Exam type</Label>
          <Select value={form.examTypeId || undefined} onValueChange={(examTypeId) => setForm({ ...form, examTypeId })}>
            <SelectTrigger id="mock-exam-type">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {examTypes.map((type) => (
                <SelectItem key={type.id} value={type.id} disabled={!type.hasEditor}>
                  {type.name}
                  {type.hasEditor ? '' : ' (no editor yet)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-level">Level</Label>
          <Select value={form.level} onValueChange={(level) => setForm({ ...form, level })}>
            <SelectTrigger id="mock-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_TEST_LEVELS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  Level {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-minutes">Minutes</Label>
          <Input id="mock-minutes" inputMode="numeric" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value.trim() })} />
        </div>
        <Button type="submit" disabled={busy || !valid} className="gap-2">
          <Plus className="h-4 w-4" />
          Add mock test
        </Button>
      </form>

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : mockTests.length === 0 ? (
        <EmptyState icon={FileText} title="No mock tests yet" description="Add the first mock test above." />
      ) : (
        <>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search mock tests by title" />
          <FilterSelect label="Exam type" value={filters.examType} onChange={setFilter('examType')} options={examTypeOptions} />
          <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-36" />
          <FilterSelect label="Status" value={filters.status} onChange={setFilter('status')} options={statusOptions} />
          <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={mockSortOptions} />
        </div>
        {shown.total === 0 ? (
          <EmptyState icon={FileText} title="No mock test matches" description="Try another search or filter." />
        ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {shown.items.map((mockTest) => (
            <li key={mockTest.id}>
              <Link
                to={`/content-manager/mock-tests/${mockTest.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{mockTest.title}</span>
                {mockTest.examType ? <Badge variant="info">{mockTest.examType.name}</Badge> : null}
                <Badge variant="secondary">Level {mockTest.level}</Badge>
                <span className="text-sm text-muted-foreground">{mockTest.durationMinutes} min</span>
                {mockTest.publishedVersionNumber ? (
                  <Badge variant="success">Published v{mockTest.publishedVersionNumber}</Badge>
                ) : (
                  <Badge variant="outline">Not published</Badge>
                )}
                {mockTest.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
        )}
        <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="mock test" onChange={setPage} />
        </>
      )}
    </section>
  );
}

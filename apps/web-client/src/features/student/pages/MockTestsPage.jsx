import { useEffect, useState } from 'react';
import { ChevronRight, Clock, FileText, ListChecks, RotateCcw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { paginate } from '../../../lib/list.js';
import { MockListSort, filterStudentMocks, mockListSortOptions } from '../lib/student-list.js';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { cn } from '../../../lib/utils.js';
import { listMockTests } from '../api/mock-api.js';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useListState } from '../../../hooks/use-list-state.js';

const PAGE_SIZE = 6;
const takenOptions = [
  { value: 'all', label: 'Taken or not' },
  { value: 'taken', label: 'Taken in full' },
  { value: 'not-taken', label: 'Not taken yet' },
];

export function MockTestsPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const { filters, setFilters, setFilter, page, setPage } = useListState({ search: '', level: 'all', examType: 'all', taken: 'all', sort: MockListSort.RECOMMENDED });

  async function load() {
    setState('loading');
    try {
      setData((await listMockTests()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the mock tests', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <CardGridPageSkeleton cards={4} />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const examTypes = [...new Map(data.mockTests.filter((item) => item.examType).map((item) => [item.examType.id, item.examType])).values()];
  const levels = [...new Set(data.mockTests.map((item) => item.level))].sort();
  const shown = paginate(filterStudentMocks(data.mockTests, filters), page, PAGE_SIZE);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Practice for the test"
        title="Mock tests"
        description="Full tests against the clock, or one part at a time."
        actions={
          <Button asChild variant="outline" className="gap-1.5">
            <Link to="/student/mock-tests/mistakes">
              <RotateCcw className="h-4 w-4" />
              Review my mistakes
            </Link>
          </Button>
        }
      />
      {data.mockTests.length === 0 ? (
        <EmptyState icon={FileText} title="No mock tests yet" description="Mock tests will appear here when they are published." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Suggested for you</p>
              <p className="text-lg font-semibold">Level {data.recommendedLevel}</p>
            </div>
            {data.mockTests.some((item) => item.recommended) ? (
              <Button variant="outline" onClick={() => setFilters({ ...filters, level: String(data.recommendedLevel) })}>
                Show level {data.recommendedLevel}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search mock tests by title" />
            {examTypes.length > 1 ? (
              <FilterSelect
                label="Exam type"
                value={filters.examType}
                onChange={setFilter('examType')}
                options={[{ value: 'all', label: 'All exam types' }, ...examTypes.map((type) => ({ value: type.id, label: type.name }))]}
              />
            ) : null}
            <FilterSelect
              label="Level"
              value={filters.level}
              onChange={setFilter('level')}
              options={[{ value: 'all', label: 'All levels' }, ...levels.map((level) => ({ value: String(level), label: `Level ${level}` }))]}
              className="w-full sm:w-36"
            />
            <FilterSelect label="Taken" value={filters.taken} onChange={setFilter('taken')} options={takenOptions} className="w-full sm:w-40" />
            <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={mockListSortOptions} />
          </div>
          {shown.total === 0 ? (
            <EmptyState icon={FileText} title="No mock test matches" description="Try another search or filter." />
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.items.map((mockTest) => (
              <li key={mockTest.id}>
                <Link
                  to={`/student/mock-tests/${mockTest.id}`}
                  className={cn(
                    'group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    mockTest.recommended && 'border-primary/50 ring-1 ring-primary/30',
                  )}
                >
                  <div className="flex items-center gap-3 border-b bg-card px-5 py-4">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                      <span className="text-[10px] font-medium uppercase leading-none opacity-80">Level</span>
                      <span className="text-lg font-bold leading-none">{mockTest.level}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{mockTest.title}</h2>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {mockTest.examType ? <Badge variant="outline">{mockTest.examType.name}</Badge> : null}
                        {mockTest.recommended ? <Badge variant="info">For you</Badge> : null}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4" />
                        {mockTest.questionCount} questions
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {mockTest.durationMinutes} min
                      </span>
                    </p>
                    {mockTest.attemptCount ? (
                      <div className="mt-auto grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{mockTest.bestPercent}%</p>
                          <p className="text-[11px] text-muted-foreground">best</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{mockTest.latestTotalScore ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground">latest score</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-2">
                          <p className="text-lg font-bold tabular-nums">{mockTest.attemptCount}</p>
                          <p className="text-[11px] text-muted-foreground">taken</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-auto rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">Not taken in full yet</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="mock test" onChange={setPage} />
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ChevronRight, Clock, FileText, ListChecks, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Skeleton } from '../../../components/ui';
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

// Mock tests with the level suggested to the learner. Every test is open; the
// suggestion only says where to start.
export function MockTestsPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  // Search, filters and sort of the list; changing one goes back to page 1.
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

  // The exam types that have a published test; the filter shows with two or more.
  const examTypes = [...new Map(data.mockTests.filter((item) => item.examType).map((item) => [item.examType.id, item.examType])).values()];
  const levels = [...new Set(data.mockTests.map((item) => item.level))].sort();
  const shown = paginate(filterStudentMocks(data.mockTests, filters), page, PAGE_SIZE);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Practice for the test"
        title="Mock tests"
        description="Take a full test against the clock, or practise one part at a time as a mini test."
      />
      {data.mockTests.length === 0 ? (
        <EmptyState icon={FileText} title="No mock tests yet" description="Mock tests will appear here when they are published." />
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Suggested for you: Level {data.recommendedLevel}</p>
              <p className="text-sm text-muted-foreground">
                Based on your latest full mock test, or on your placement test before that. You can
                take any test.
              </p>
            </div>
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
          <ul className="grid gap-4 sm:grid-cols-2">
            {shown.items.map((mockTest) => (
              <li key={mockTest.id}>
                <Link
                  to={`/student/mock-tests/${mockTest.id}`}
                  className={cn(
                    'group flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    mockTest.recommended && 'border-primary/50',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {mockTest.examType ? <Badge variant="outline">{mockTest.examType.name}</Badge> : null}
                    <Badge variant="secondary">Level {mockTest.level}</Badge>
                    {mockTest.recommended ? <Badge variant="info">Recommended for you</Badge> : null}
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{mockTest.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4" />
                      {mockTest.questionCount} questions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {mockTest.durationMinutes} minutes
                    </span>
                  </p>
                  <p className="mt-4 border-t pt-3 text-sm">
                    {mockTest.attemptCount ? (
                      <>
                        Taken {mockTest.attemptCount} time{mockTest.attemptCount === 1 ? '' : 's'} · best{' '}
                        <span className="font-semibold">{mockTest.bestPercent}%</span> · latest estimated score{' '}
                        <span className="font-semibold">{mockTest.latestTotalScore}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not taken in full yet</span>
                    )}
                  </p>
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

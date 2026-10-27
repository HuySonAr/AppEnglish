import { useEffect, useState } from 'react';
import { ChevronRight, Mic, MicVocal, PenLine } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SwSection } from '@appenglish/content-contracts';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { CardGridPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { Button } from '../../../components/ui';
import { useListState } from '../../../hooks/use-list-state.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
import { listSwTests } from '../api/sw-test-api.js';
import { SwListSort, filterStudentSwTests, latestAttempt, sectionInfo, swListSortOptions, swTakenOptions } from '../lib/sw-exam.js';
import { swResultPath } from '../lib/sw-score.js';
import { SwAttemptBadge } from '../components/SwScoreParts.jsx';

const PAGE_SIZE = 6;
const DEFAULTS = { search: '', taken: 'all', sort: SwListSort.TITLE_ASC };
const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function SectionRow({ test, section, icon: Icon, onTake }) {
  const history = test[section];
  const latest = latestAttempt(history);
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-background p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{sectionInfo[section].label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {latest ? `Last taken ${dateText(latest.submittedAt)} · ${history.attempts.length} attempt${history.attempts.length === 1 ? '' : 's'}` : 'Not taken yet'}
        </p>
      </div>
      {latest ? (
        <Link to={swResultPath(test.id, section, latest.attemptNumber)} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SwAttemptBadge attempt={latest} />
        </Link>
      ) : null}
      <Button size="sm" variant={latest ? 'outline' : 'default'} onClick={onTake}>
        Take {sectionInfo[section].label}
      </Button>
    </div>
  );
}

export function SwTestsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [tests, setTests] = useState([]);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);

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

  if (state === 'loading') return <CardGridPageSkeleton cards={4} />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const shown = paginate(filterStudentSwTests(tests, filters), page, PAGE_SIZE);
  const take = (id, section) => navigate(`/student/sw-tests/${id}`, { state: { start: section } });

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Practice for the test" title="S&W tests" description="Take the Speaking or the Writing part, in the real exam order." />
      {tests.length === 0 ? (
        <EmptyState icon={MicVocal} title="No S&W tests yet" description="Tests will appear here when they are published." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search tests by title" />
            <FilterSelect label="Taken" value={filters.taken} onChange={setFilter('taken')} options={swTakenOptions} className="w-full sm:w-40" />
            <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={swListSortOptions} />
            {filters.search || filters.taken !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={() => setFilters((current) => ({ ...DEFAULTS, sort: current.sort }))}>
                Clear filters
              </Button>
            ) : null}
          </div>
          {shown.total === 0 ? <EmptyState icon={MicVocal} title="No test matches" description="Try another search or filter." /> : null}
          <ul className="grid gap-4 lg:grid-cols-2">
            {shown.items.map((test) => (
              <li key={test.id} className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm">
                <Link to={`/student/sw-tests/${test.id}`} className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <MicVocal className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{test.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      Speaking {sectionInfo.speaking.questions} · Writing {sectionInfo.writing.questions}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
                <SectionRow test={test} section={SwSection.SPEAKING} icon={Mic} onTake={() => take(test.id, SwSection.SPEAKING)} />
                <SectionRow test={test} section={SwSection.WRITING} icon={PenLine} onTake={() => take(test.id, SwSection.WRITING)} />
              </li>
            ))}
          </ul>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="test" onChange={setPage} />
        </>
      )}
    </section>
  );
}

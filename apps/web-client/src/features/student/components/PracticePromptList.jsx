import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import {
  DEFAULT_PRACTICE_LEVEL,
  PracticeSort,
  PracticeTried,
  filterPracticePrompts,
  practiceLevelOptions,
  practiceSortOptions,
  practiceTopicOptions,
  practiceTriedOptions,
  scoreTone,
  toneText,
} from '../lib/practice.js';

const PAGE_SIZE = 12;
const DEFAULTS = { search: '', level: DEFAULT_PRACTICE_LEVEL, topic: 'all', kind: 'all', tried: PracticeTried.ALL, sort: PracticeSort.LEVEL };
const labelOf = (kindLabel, prompt) => (typeof kindLabel === 'function' ? kindLabel(prompt) : kindLabel);

export function PracticePromptList({ title, description, icon, kindLabel, basePath, load: loadPrompts, maxScore = 10, notice }) {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      setData((await loadPrompts()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const back = <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: title }]} />;
  if (state === 'loading') return <ListPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const prompts = data.prompts;
  const kinds = [...new Set(prompts.map((prompt) => prompt.kind))];
  const kindOptions = [{ value: 'all', label: 'All kinds' }, ...kinds.map((kind) => ({ value: kind, label: labelOf(kindLabel, { kind }) }))];
  const shown = paginate(filterPracticePrompts(prompts, filters), page, PAGE_SIZE);
  const narrowed = Object.entries(DEFAULTS).some(([key, value]) => filters[key] !== value);

  return (
    <section className="space-y-6">
      {back}
      <PageHeader eyebrow="Practice" title={title} description={description} />
      {notice ? notice(data) : null}
      {prompts.length === 0 ? (
        <EmptyState icon={icon} title="No prompts yet" description="Prompts will appear here when they are published." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title or topic" />
            <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={practiceLevelOptions} className="w-full sm:w-32" />
            <FilterSelect label="Topic" value={filters.topic} onChange={setFilter('topic')} options={practiceTopicOptions(prompts)} className="w-full sm:w-40" />
            {kinds.length > 1 ? <FilterSelect label="Kind" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} className="w-full sm:w-40" /> : null}
            <FilterSelect label="Tried" value={filters.tried} onChange={setFilter('tried')} options={practiceTriedOptions} />
            <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={practiceSortOptions} />
          </div>
          {shown.total === 0 ? (
            <EmptyState
              icon={icon}
              title="No prompt matches"
              description="Try another level or filter."
              action={
                narrowed ? (
                  <Button variant="outline" onClick={() => setFilters({ ...DEFAULTS, level: 'all' })}>
                    Show all prompts
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.items.map((prompt) => (
                <li key={prompt.id}>
                  <Link
                    to={`${basePath}/${prompt.id}`}
                    className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{prompt.level}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug">{prompt.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {labelOf(kindLabel, prompt)} · {prompt.topic}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    {prompt.attempts ? (
                      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {prompt.attempts} attempt{prompt.attempts === 1 ? '' : 's'}
                        </span>
                        <span>
                          Best{' '}
                          <span className={cn('text-sm font-semibold tabular-nums', toneText[scoreTone(prompt.bestTotal, maxScore)])}>
                            {prompt.bestTotal === null ? '—' : `${prompt.bestTotal.toFixed(1)}/${maxScore}`}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="mt-auto self-start">
                        New
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="prompt" onChange={setPage} />
        </>
      )}
    </section>
  );
}

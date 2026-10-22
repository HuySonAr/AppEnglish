import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Headphones } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LISTENING_KINDS, LISTENING_LEVELS } from '@appenglish/content-contracts';
import { ListeningMode } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { listListeningPractice } from '../api/practice-api.js';
import {
  ListeningDone,
  ListeningSort,
  exercisesFor,
  filterListeningPractice,
  kindLabel,
  listeningDoneOptions,
  listeningSortOptions,
  modeLabels,
  resultOf,
  topicModes,
} from '../lib/listening-practice.js';
import { useListState } from '../../../hooks/use-list-state.js';

const PAGE_SIZE = 10;
const levelOptions = [{ value: 'all', label: 'All levels' }, ...LISTENING_LEVELS.map((level) => ({ value: level, label: level }))];

export function ListeningExerciseListPage() {
  const { topicId, mode } = useParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const { filters, setFilters, setFilter, page, setPage } = useListState({ search: '', level: 'all', kind: 'all', done: ListeningDone.ALL, sort: ListeningSort.LEVEL });

  async function load() {
    setState('loading');
    try {
      setData((await listListeningPractice()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the exercises', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [topicId, mode]);

  const topic = data?.topics.find((item) => item.id === topicId);
  const modes = topicModes(topic);
  const back = (
    <Link
      to={modes.length > 1 ? `/student/practice/listening/topics/${topicId}` : '/student/practice/listening'}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {modes.length > 1 && topic ? topic.name : 'Listening'}
    </Link>
  );

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
  if (!topic || !modes.includes(mode))
    return (
      <section className="space-y-6">
        {back}
        <EmptyState icon={Headphones} title="Nothing to practise here" description="This topic has no exercises for this way of practising." />
      </section>
    );

  const all = exercisesFor(data.exercises, topicId, mode);
  const kinds = [...new Set(all.map((exercise) => exercise.kind))];
  const kindOptions = [
    { value: 'all', label: 'All parts' },
    ...Object.values(LISTENING_KINDS)
      .flat()
      .filter((kind) => kinds.includes(kind.key))
      .map((kind) => ({ value: kind.key, label: kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title })),
  ];
  const shown = paginate(filterListeningPractice(data.exercises, { ...filters, topic: topicId, mode }), page, PAGE_SIZE);
  const blanks = mode === ListeningMode.BLANKS;

  return (
    <section className="space-y-6">
      {back}
      <PageHeader eyebrow={topic.name} title={modes.length > 1 ? modeLabels[mode] : topic.name} description="Choose an exercise." />

      {all.length === 0 ? (
        <EmptyState icon={Headphones} title="No exercises yet" description="Exercises will appear here when they are published." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title" />
            <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-32" />
            {kinds.length > 1 ? <FilterSelect label="Part" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} /> : null}
            <FilterSelect label="Tried" value={filters.done} onChange={setFilter('done')} options={listeningDoneOptions} />
            <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={listeningSortOptions} />
          </div>
          {shown.total === 0 ? (
            <EmptyState icon={Headphones} title="No exercise matches" description="Try another search or filter." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.items.map((exercise) => {
                const result = resultOf(exercise, mode);
                return (
                  <li key={exercise.id}>
                    <Link
                      to={`/student/practice/listening/${exercise.id}?mode=${mode}`}
                      className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{exercise.level}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug">{exercise.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {kindLabel(exercise.kind)} ·{' '}
                            {blanks
                              ? `${exercise.blankCount} blank${exercise.blankCount === 1 ? '' : 's'}`
                              : `${exercise.segmentCount} ${exercise.kind === 'song' ? 'line' : 'sentence'}${exercise.segmentCount === 1 ? '' : 's'}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                      {result.checkCount ? (
                        <div className="mt-auto space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Best</span>
                            <span className={cn('font-semibold tabular-nums', result.bestAccuracy >= 80 ? 'text-success' : 'text-foreground')}>{result.bestAccuracy}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <div className={cn('h-full rounded-full transition-all', result.bestAccuracy >= 80 ? 'bg-success' : 'bg-primary')} style={{ width: `${result.bestAccuracy}%` }} />
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="mt-auto self-start">
                          New
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="exercise" onChange={setPage} />
        </>
      )}
    </section>
  );
}

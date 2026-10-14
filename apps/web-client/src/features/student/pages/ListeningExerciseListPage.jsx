import { useEffect, useState } from 'react';
import { ArrowLeft, Headphones } from 'lucide-react';
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

const PAGE_SIZE = 10;
const levelOptions = [{ value: 'all', label: 'All levels' }, ...LISTENING_LEVELS.map((level) => ({ value: level, label: level }))];

// Listening practice (D92), last step before practising: the exercises of
// one topic in one way of practising, searched, filtered, sorted and paged,
// each with the learner's best score in that way.
export function ListeningExerciseListPage() {
  const { topicId, mode } = useParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ search: '', level: 'all', kind: 'all', done: ListeningDone.ALL, sort: ListeningSort.LEVEL });
  const [page, setPage] = useState(1);
  const setFilter = (name) => (value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

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
  // Back to the choice of a way of practising when the topic has several.
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
      <PageHeader eyebrow={topic.name} title={modes.length > 1 ? modeLabels[mode] : topic.name} description="Choose an exercise. Your best score is kept for each one." />

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
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {shown.items.map((exercise) => {
                const result = resultOf(exercise, mode);
                return (
                  <li key={exercise.id}>
                    <Link
                      to={`/student/practice/listening/${exercise.id}?mode=${mode}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{exercise.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {kindLabel(exercise.kind)} ·{' '}
                          {blanks
                            ? `${exercise.blankCount} blank${exercise.blankCount === 1 ? '' : 's'}`
                            : `${exercise.segmentCount} ${exercise.kind === 'song' ? 'line' : 'sentence'}${exercise.segmentCount === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <Badge variant="secondary">{exercise.level}</Badge>
                      {result.checkCount ? (
                        <span className={cn('text-sm font-semibold tabular-nums', result.bestAccuracy >= 80 ? 'text-success' : 'text-foreground')}>
                          Best {result.bestAccuracy}%
                        </span>
                      ) : (
                        <Badge variant="outline">New</Badge>
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

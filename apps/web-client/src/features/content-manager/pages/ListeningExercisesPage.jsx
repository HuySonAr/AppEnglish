import { useEffect, useState } from 'react';
import { ChevronRight, Headphones, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LISTENING_KINDS, LISTENING_LEVELS } from '@appenglish/content-contracts';
import { listListeningTopics } from '../../../lib/api/listening-topics-api.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { createListeningExercise, listListeningExercises } from '../api/content-api.js';
import {
  ListeningSort,
  StatusFilter,
  filterListeningExercises,
  listeningSortOptions,
  statusOptions,
} from '../lib/content-list.js';
import { listeningKindOf } from '../lib/listening-draft.js';
import { useListState } from '../../../hooks/use-list-state.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', topic: 'all', level: 'all', kind: 'all', status: StatusFilter.ALL, sort: ListeningSort.NEWEST };
const levelOptions = [{ value: 'all', label: 'All levels' }, ...LISTENING_LEVELS.map((level) => ({ value: level, label: level }))];
const kindName = (kind) => (kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title);
const allKinds = Object.values(LISTENING_KINDS).flat();
const kindLabel = (key) => {
  const kind = listeningKindOf(key);
  return kind ? kindName(kind) : key;
};
const kindsOf = (topic) => LISTENING_KINDS[topic?.format] || [];

function NewExerciseDialog({ open, onOpenChange, topics, initialTopicId }) {
  const navigate = useNavigate();
  const writable = topics.filter((topic) => topic.hasEditor);
  const [form, setForm] = useState({ title: '', topicId: '', level: 'B1', kind: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const topic = writable.find((item) => item.id === initialTopicId) || writable[0];
    setForm({ title: '', topicId: topic?.id || '', level: 'B1', kind: kindsOf(topic)[0]?.key || '' });
  }, [open]);

  const topicKinds = kindsOf(topics.find((topic) => topic.id === form.topicId));
  const valid = form.title.trim() && form.topicId && topicKinds.some((item) => item.key === form.kind);
  const chooseTopic = (topic) => setForm((current) => ({ ...current, topicId: topic.id, kind: kindsOf(topic).some((item) => item.key === current.kind) ? current.kind : kindsOf(topic)[0]?.key || '' }));

  async function onCreate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createListeningExercise({ ...form, title: form.title.trim() });
      notify({ title: 'Listening exercise created' });
      navigate(`/content-manager/listening/${result.data.exercise.id}`);
    } catch (error) {
      notify({ title: 'Could not create the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onCreate} className="space-y-5">
          <DialogHeader>
            <DialogTitle>New listening exercise</DialogTitle>
            <DialogDescription>Add the recording and sentences on the next page.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Topic</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {writable.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  aria-pressed={form.topicId === topic.id}
                  onClick={() => chooseTopic(topic)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    form.topicId === topic.id ? 'border-primary bg-primary/5 font-medium text-primary' : 'hover:bg-accent',
                  )}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="listening-title">Title</Label>
            <Input id="listening-title" autoFocus value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <div className="flex flex-wrap gap-1.5">
              {LISTENING_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={form.level === level}
                  onClick={() => setForm({ ...form, level })}
                  className={cn(
                    'h-9 min-w-12 rounded-md border px-3 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    form.level === level ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {topicKinds.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="listening-kind">Kind</Label>
              <Select value={form.kind || undefined} onValueChange={(kind) => kind && setForm({ ...form, kind })}>
                <SelectTrigger id="listening-kind">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {topicKinds.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {kindName(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

function ExerciseRow({ exercise, showTopic }) {
  return (
    <li>
      <Link
        to={`/content-manager/listening/${exercise.id}`}
        className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums">{exercise.level}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{exercise.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {kindLabel(exercise.kind)}
            {showTopic && exercise.topic ? ` · ${exercise.topic.name}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {exercise.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
          {exercise.publishedVersionNumber ? <Badge variant="success">Published v{exercise.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export function ListeningExercisesPage() {
  const [state, setState] = useState('loading');
  const [exercises, setExercises] = useState([]);
  const [topics, setTopics] = useState([]);
  const [creating, setCreating] = useState(false);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      const [list, topicList] = await Promise.all([listListeningExercises(), listListeningTopics()]);
      setExercises(list.data.exercises);
      setTopics(topicList.data.topics);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the listening exercises', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = paginate(filterListeningExercises(exercises, filters), page, PAGE_SIZE);
  const currentTopic = topics.find((topic) => topic.id === filters.topic);
  const kindChoices = currentTopic ? kindsOf(currentTopic) : allKinds;
  const kindOptions = [{ value: 'all', label: 'All kinds' }, ...kindChoices.map((kind) => ({ value: kind.key, label: kindName(kind) }))];
  const countOf = (topicId) => exercises.filter((exercise) => exercise.topic?.id === topicId).length;
  const narrowed = filters.search || filters.level !== 'all' || filters.kind !== 'all' || filters.status !== StatusFilter.ALL;
  const chooseTopic = (topic) => setFilters((current) => ({ ...current, topic, kind: 'all' }));
  const clear = () => setFilters((current) => ({ ...DEFAULTS, topic: current.topic, sort: current.sort }));

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Listening exercises"
        description="Dictation exercises for the listening practice."
        actions={
          <Button className="gap-2" disabled={state !== 'ready' || !topics.some((topic) => topic.hasEditor)} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New exercise
          </Button>
        }
      />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : exercises.length === 0 ? (
        <EmptyState
          icon={Headphones}
          title="No listening exercises yet"
          description="Create the first exercise."
          action={
            <Button className="gap-2" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New exercise
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <Tabs value={filters.topic} onValueChange={chooseTopic}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="all">All ({exercises.length})</TabsTrigger>
              {topics.map((topic) => (
                <TabsTrigger key={topic.id} value={topic.id}>
                  {topic.name} ({countOf(topic.id)})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="space-y-3 border-b bg-muted/30 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title" />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-32" />
                  <FilterSelect label="Kind" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} />
                  <FilterSelect label="Status" value={filters.status} onChange={setFilter('status')} options={statusOptions} className="w-full sm:w-40" />
                  <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={listeningSortOptions} className="w-full sm:w-40" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {shown.total} exercise{shown.total === 1 ? '' : 's'}
                </span>
                {narrowed ? (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={clear}>
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>

            {shown.total === 0 ? (
              <div className="p-6">
                <EmptyState icon={Headphones} title="No exercise matches" description="Try another search or filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((exercise) => (
                  <ExerciseRow key={exercise.id} exercise={exercise} showTopic={filters.topic === 'all'} />
                ))}
              </ul>
            )}
          </div>

          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="exercise" onChange={setPage} />
        </div>
      )}

      <NewExerciseDialog open={creating} onOpenChange={setCreating} topics={topics} initialTopicId={filters.topic} />
    </section>
  );
}

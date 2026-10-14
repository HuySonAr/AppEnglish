import { useEffect, useState } from 'react';
import { Headphones, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LISTENING_KINDS, LISTENING_LEVELS } from '@appenglish/content-contracts';
import { listListeningTopics } from '../../../lib/api/listening-topics-api.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
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

const PAGE_SIZE = 10;
const levelOptions = [{ value: 'all', label: 'All levels' }, ...LISTENING_LEVELS.map((level) => ({ value: level, label: level }))];
const kindName = (kind) => (kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title);
const kindOptions = [
  { value: 'all', label: 'All kinds' },
  ...Object.values(LISTENING_KINDS).flat().map((kind) => ({ value: kind.key, label: kindName(kind) })),
];
const kindLabel = (key) => {
  const kind = listeningKindOf(key);
  return kind ? kindName(kind) : key;
};

// Listening exercises (F05B-2, D85): the list (searched, filtered, sorted and
// paged) and the form to add one. The recording and its sentences are written
// on the exercise's own page.
export function ListeningExercisesPage() {
  const [state, setState] = useState('loading');
  const [exercises, setExercises] = useState([]);
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState({ title: '', topicId: '', level: 'B1', kind: 'part1' });
  const [busy, setBusy] = useState(false);
  // Search, filters and sort of the list; changing one goes back to page 1.
  const [filters, setFilters] = useState({ search: '', topic: 'all', level: 'all', kind: 'all', status: StatusFilter.ALL, sort: ListeningSort.NEWEST });
  const [page, setPage] = useState(1);
  const setFilter = (name) => (value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  async function load() {
    setState('loading');
    try {
      const [list, topicList] = await Promise.all([listListeningExercises(), listListeningTopics()]);
      setExercises(list.data.exercises);
      setTopics(topicList.data.topics);
      // A new exercise is for the first topic that has an editor (TOEIC).
      setForm((current) => {
        const topic = topicList.data.topics.find((item) => item.id === current.topicId) || topicList.data.topics.find((item) => item.hasEditor);
        const kinds = LISTENING_KINDS[topic?.format] || [];
        return { ...current, topicId: topic?.id || '', kind: kinds.some((kind) => kind.key === current.kind) ? current.kind : kinds[0]?.key || '' };
      });
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
  // The kinds the chosen topic's format has: the four parts, or a song. A
  // topic with a single kind (songs) needs no choice: its kind is used as is.
  const topicKinds = LISTENING_KINDS[topics.find((topic) => topic.id === form.topicId)?.format] || [];
  const kind = topicKinds.length === 1 ? topicKinds[0].key : form.kind;
  // Radix selects inside a form can report '' while their items change; an
  // empty value is never a choice here.
  const choose = (field) => (value) => {
    if (value) setForm((current) => ({ ...current, [field]: value }));
  };
  const chooseTopic = (topicId) => {
    if (!topicId) return;
    const kinds = LISTENING_KINDS[topics.find((topic) => topic.id === topicId)?.format] || [];
    setForm((current) => ({ ...current, topicId, kind: kinds.some((item) => item.key === current.kind) ? current.kind : kinds[0]?.key || '' }));
  };
  const valid = form.title.trim() && form.topicId && topicKinds.some((item) => item.key === kind);
  const topicOptions = [{ value: 'all', label: 'All topics' }, ...topics.map((topic) => ({ value: topic.id, label: topic.name }))];

  async function onCreate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await createListeningExercise({ ...form, kind, title: form.title.trim() });
      setForm((current) => ({ ...current, title: '' }));
      notify({ title: 'Listening exercise created' });
      await load();
    } catch (error) {
      notify({ title: 'Could not create the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Listening exercises"
        description="Dictation for the listening practice: learners hear a recording and write down each sentence."
      />

      <form onSubmit={onCreate} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_10rem_6rem_13rem_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="listening-title">New exercise title</Label>
          <Input id="listening-title" value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listening-topic">Topic</Label>
          <Select value={form.topicId || undefined} onValueChange={chooseTopic}>
            <SelectTrigger id="listening-topic">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {topics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id} disabled={!topic.hasEditor}>
                  {topic.name}
                  {topic.hasEditor ? '' : ' (no editor yet)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="listening-level">Level</Label>
          <Select value={form.level} onValueChange={choose('level')}>
            <SelectTrigger id="listening-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LISTENING_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="listening-kind">Kind</Label>
          {topicKinds.length > 1 ? (
            <Select value={form.kind || undefined} onValueChange={choose('kind')}>
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
          ) : (
            <p id="listening-kind" className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              {topicKinds.length ? kindName(topicKinds[0]) : 'Choose a topic'}
            </p>
          )}
        </div>
        <Button type="submit" loading={busy} disabled={busy || !valid} className="gap-2">
          <Plus className="h-4 w-4" />
          Add exercise
        </Button>
      </form>

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : exercises.length === 0 ? (
        <EmptyState icon={Headphones} title="No listening exercises yet" description="Add the first exercise above." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search exercises by title" />
            <FilterSelect label="Topic" value={filters.topic} onChange={setFilter('topic')} options={topicOptions} />
            <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-32" />
            <FilterSelect label="Kind" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} />
            <FilterSelect label="Status" value={filters.status} onChange={setFilter('status')} options={statusOptions} />
            <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={listeningSortOptions} />
          </div>
          {shown.total === 0 ? (
            <EmptyState icon={Headphones} title="No exercise matches" description="Try another search or filter." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {shown.items.map((exercise) => (
                <li key={exercise.id}>
                  <Link
                    to={`/content-manager/listening/${exercise.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{exercise.title}</span>
                    {exercise.topic ? <Badge variant="info">{exercise.topic.name}</Badge> : null}
                    <Badge variant="secondary">{exercise.level}</Badge>
                    <span className="text-sm text-muted-foreground">{kindLabel(exercise.kind)}</span>
                    {exercise.publishedVersionNumber ? (
                      <Badge variant="success">Published v{exercise.publishedVersionNumber}</Badge>
                    ) : (
                      <Badge variant="outline">Not published</Badge>
                    )}
                    {exercise.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="exercise" onChange={setPage} />
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GraduationCap, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COURSE_LEVELS, COURSE_TEST_LEVELS, CourseItemType } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { matchesSearch, paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Input, Label, Tabs, TabsList, TabsTrigger } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { useFocusReturn, useListLinkState } from '../../../hooks/use-return-to.js';
import { createCourseItem, listListeningCourse, updateCourseItem } from '../api/content-api.js';

const PAGE_SIZE = 10;

function Status({ item }) {
  return (
    <>
      {item.publishedVersionNumber ? <Badge variant="success">Published v{item.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
      {item.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
    </>
  );
}

// The Listening course (D143–D145) for a Content Manager: each level A1–C2
// with its topics in order (one listening lesson each) and, for every level
// but the last, the level test that opens the next level.
export function CourseManagePage() {
  const [state, setState] = useState('loading');
  const [levels, setLevels] = useState([]);
  const [form, setForm] = useState({ title: '', description: '' });
  const [busy, setBusy] = useState(false);
  const linkState = useListLinkState();
  const { filters, setFilter, page, setPage } = useListState({ level: COURSE_LEVELS[0], search: '' });

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setLevels((await listListeningCourse()).data.levels);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the listening course', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);
  useFocusReturn(state === 'ready');

  async function run(action, success, failure) {
    setBusy(true);
    try {
      await action();
      notify({ title: success });
      await load({ quiet: true });
      return true;
    } catch (error) {
      notify({ title: failure, description: getApiErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAddTopic(event) {
    event.preventDefault();
    const added = await run(
      () => createCourseItem({ level: filters.level, type: CourseItemType.TOPIC, title: form.title.trim(), description: form.description.trim() }),
      'Topic added',
      'Could not add the topic',
    );
    if (added) setForm({ title: '', description: '' });
  }

  if (state === 'loading') return <ListPageSkeleton rows={6} />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={() => load()}>
        Try again
      </Button>
    );

  const entry = levels.find((item) => item.level === filters.level) || levels[0];
  const found = entry.topics.filter((topic) => matchesSearch(`${topic.title} ${topic.description}`, filters.search));
  const shown = paginate(found, page, PAGE_SIZE);
  // Moving a topic needs the whole list in its order.
  const reorderable = !filters.search;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Listening course"
        description="Topics and level tests from A1 to C2."
      />

      <Tabs value={entry.level} onValueChange={setFilter('level')}>
        <TabsList className="flex-wrap">
          {levels.map((item) => (
            <TabsTrigger key={item.level} value={item.level}>
              {item.level} ({item.topics.length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <form onSubmit={onAddTopic} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="topic-title">New {entry.level} topic</Label>
          <Input id="topic-title" placeholder="e.g. Ordering food" maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic-description">Description (optional)</Label>
          <Input id="topic-description" maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </div>
        <Button type="submit" loading={busy} disabled={busy || !form.title.trim()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add topic
        </Button>
      </form>

      {entry.topics.length === 0 ? (
        <EmptyState icon={GraduationCap} title={`No ${entry.level} topic yet`} description="Add the first topic above." />
      ) : (
        <div className="space-y-3">
          <SearchField label="Search topics" placeholder={`Search ${entry.level} topics`} value={filters.search} onChange={setFilter('search')} />
          {found.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No topic matches" description="Try another search." />
          ) : (
            <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {shown.items.map((topic) => {
                const index = entry.topics.findIndex((item) => item.id === topic.id);
                return (
                  <li key={topic.id} id={`focus-${topic.id}`} className="flex scroll-mt-24 flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-6 text-sm font-semibold text-muted-foreground">{topic.position}</span>
                    <Link to={`/content-manager/listening-course/${topic.id}`} state={linkState(topic.id)} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {topic.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {topic.hasRecording ? 'Recording' : 'No recording'} · {topic.words} word{topic.words === 1 ? '' : 's'} · {topic.questions} question{topic.questions === 1 ? '' : 's'}
                      {topic.ordering ? ' · ordering' : ''}
                    </span>
                    <Status item={topic} />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${topic.title} up`}
                      disabled={busy || !reorderable || index === 0}
                      onClick={() => run(() => updateCourseItem(topic.id, { position: index }), 'Topic moved', 'Could not move the topic')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${topic.title} down`}
                      disabled={busy || !reorderable || index === entry.topics.length - 1}
                      onClick={() => run(() => updateCourseItem(topic.id, { position: index + 2 }), 'Topic moved', 'Could not move the topic')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="topic" onChange={setPage} />
          {!reorderable ? <p className="text-xs text-muted-foreground">Clear the search to change the order.</p> : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-card p-4">
        <GraduationCap className="h-5 w-5 text-primary" />
        {!COURSE_TEST_LEVELS.includes(entry.level) ? (
          <span className="text-sm text-muted-foreground">{entry.level} is the last level: it has no level test.</span>
        ) : entry.levelTest ? (
          <>
            <Link to={`/content-manager/listening-course/${entry.levelTest.id}`} state={linkState(entry.levelTest.id)} className="font-medium hover:underline">
              {entry.levelTest.title}
            </Link>
            <span className="text-sm text-muted-foreground">{entry.levelTest.questions} questions · opens the next level</span>
            <Status item={entry.levelTest} />
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">No {entry.level} level test yet. Learners pass it to open the next level.</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              loading={busy}
              disabled={busy}
              onClick={() =>
                run(
                  () => createCourseItem({ level: entry.level, type: CourseItemType.LEVEL_TEST, title: `${entry.level} level test`, description: '' }),
                  'Level test created',
                  'Could not create the level test',
                )
              }
            >
              Create the level test
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

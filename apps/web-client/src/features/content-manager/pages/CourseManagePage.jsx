import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, GraduationCap, ListOrdered, Mic, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COURSE_LEVELS, COURSE_TEST_LEVELS, CourseItemType } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { matchesSearch, paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
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
      {item.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
      {item.publishedVersionNumber ? <Badge variant="success">Published v{item.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
    </>
  );
}

function Fact({ ok, icon: Icon, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1', ok ? 'text-foreground' : 'text-muted-foreground')}>
      {ok ? <Check className="h-3 w-3 text-success" /> : <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

export function CourseManagePage() {
  const [state, setState] = useState('loading');
  const [levels, setLevels] = useState([]);
  const [creating, setCreating] = useState(null);
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
  const reorderable = !filters.search;
  const published = entry.topics.filter((topic) => topic.publishedVersionNumber).length;
  const hasTest = COURSE_TEST_LEVELS.includes(entry.level);

  async function onAddTopic(event) {
    event.preventDefault();
    const added = await run(
      () => createCourseItem({ level: entry.level, type: CourseItemType.TOPIC, title: creating.title.trim(), description: creating.description.trim() }),
      'Topic added',
      'Could not add the topic',
    );
    if (added) setCreating(null);
  }

  const newButton = (
    <Button className="gap-2" onClick={() => setCreating({ title: '', description: '' })}>
      <Plus className="h-4 w-4" />
      New {entry.level} topic
    </Button>
  );

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Content Manager" title="Listening course" description="Topics and level tests from A1 to C2." actions={newButton} />

      <Tabs value={entry.level} onValueChange={setFilter('level')}>
        <TabsList className="h-auto flex-wrap justify-start">
          {levels.map((item) => (
            <TabsTrigger key={item.level} value={item.level} className="gap-1.5">
              <span className="font-semibold">{item.level}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{item.topics.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4 border-b p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">{entry.level}</div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-lg font-semibold">Level {entry.level}</h2>
            <div className="flex max-w-sm items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-success" style={{ width: `${entry.topics.length ? (published * 100) / entry.topics.length : 0}%` }} />
              </span>
              <span className="shrink-0 tabular-nums">
                {published}/{entry.topics.length} topics published
              </span>
            </div>
          </div>
          {entry.topics.length ? (
            <div className="w-full sm:w-72">
              <SearchField label="Search topics" placeholder={`Search ${entry.level} topics`} value={filters.search} onChange={setFilter('search')} />
            </div>
          ) : null}
        </div>

        {entry.topics.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={GraduationCap} title={`No ${entry.level} topic yet`} description="Create the first topic." action={newButton} />
          </div>
        ) : found.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={GraduationCap} title="No topic matches" description="Try another search." />
          </div>
        ) : (
          <ol className="divide-y">
            {shown.items.map((topic) => {
              const index = entry.topics.findIndex((item) => item.id === topic.id);
              return (
                <li key={topic.id} id={`focus-${topic.id}`} className="group flex scroll-mt-24 items-center gap-2 pr-2 transition-colors hover:bg-accent">
                  <Link
                    to={`/content-manager/listening-course/${topic.id}`}
                    state={linkState(topic.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums text-muted-foreground">{topic.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{topic.title}</span>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        <Fact ok={topic.hasRecording} icon={Mic}>
                          Recording
                        </Fact>
                        <Fact ok={topic.words > 0} icon={Plus}>
                          {topic.words} word{topic.words === 1 ? '' : 's'}
                        </Fact>
                        <Fact ok={topic.questions > 0} icon={Plus}>
                          {topic.questions} question{topic.questions === 1 ? '' : 's'}
                        </Fact>
                        {topic.ordering ? (
                          <Fact ok icon={ListOrdered}>
                            Ordering
                          </Fact>
                        ) : null}
                      </span>
                    </span>
                    <span className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                      <Status item={topic} />
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Move ${topic.title} up`}
                      disabled={busy || !reorderable || index === 0}
                      onClick={() => run(() => updateCourseItem(topic.id, { position: index }), 'Topic moved', 'Could not move the topic')}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Move ${topic.title} down`}
                      disabled={busy || !reorderable || index === entry.topics.length - 1}
                      onClick={() => run(() => updateCourseItem(topic.id, { position: index + 2 }), 'Topic moved', 'Could not move the topic')}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!hasTest ? (
          <div className="flex items-center gap-3 border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            {entry.level} is the last level, so it has no level test.
          </div>
        ) : entry.levelTest ? (
          <Link
            to={`/content-manager/listening-course/${entry.levelTest.id}`}
            state={linkState(entry.levelTest.id)}
            className="group flex items-center gap-3 border-t bg-muted/20 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-info/10 text-info">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{entry.levelTest.title}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">{entry.levelTest.questions} questions · opens the next level</span>
            </span>
            <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Status item={entry.levelTest} />
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm text-muted-foreground">No {entry.level} level test yet.</span>
            <Button
              variant="outline"
              size="sm"
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
          </div>
        )}
      </div>

      <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="topic" onChange={setPage} />
      {!reorderable ? <p className="text-xs text-muted-foreground">Clear the search to change the order.</p> : null}

      <Dialog open={creating !== null} onOpenChange={(open) => !open && !busy && setCreating(null)}>
        <DialogContent>
          <form onSubmit={onAddTopic} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New {entry.level} topic</DialogTitle>
              <DialogDescription>Add its recording and exercises after creating it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="topic-title">Topic</Label>
              <Input id="topic-title" autoFocus placeholder="Ordering food" maxLength={200} value={creating?.title || ''} onChange={(event) => setCreating({ ...creating, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-description">Description (optional)</Label>
              <Input id="topic-description" maxLength={2000} value={creating?.description || ''} onChange={(event) => setCreating({ ...creating, description: event.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={busy || !creating?.title.trim()}>
                Create topic
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

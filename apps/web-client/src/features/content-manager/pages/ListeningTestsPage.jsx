import { useEffect, useState } from 'react';
import { ChevronRight, Headphones, ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LISTENING_TOEIC_KINDS, LessonVersionStatus, ListeningFormat } from '@appenglish/content-contracts';
import { ReviewStatusBadge } from '../components/ContentReview.jsx';
import { useContentArea } from '../hooks/use-content-area.js';
import { createListeningTest, deleteListeningTest, listListeningTests, listListeningTopics, updateListeningTest } from '../../../lib/api/listening-topics-api.js';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { createListeningExercise, listListeningExercises } from '../api/content-api.js';

function NameDialog({ open, title, description, label, initial = '', submitLabel = 'Create', onOpenChange, onSave }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initial);
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(name.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="listening-name">{label}</Label>
            <Input id="listening-name" autoFocus value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={busy || !name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PartColumn({ kind, exercises, base, canAuthor, onAdd }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Part {kind.number}</span>
        <span className="truncate text-sm text-muted-foreground">{kind.title}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{exercises.length}</span>
      </div>
      <ul className="flex-1 divide-y">
        {exercises.map((exercise, index) => (
          <li key={exercise.id}>
            <Link to={`${base}/listening/${exercise.id}`} className="group flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent">
              <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{exercise.title}</span>
              {exercise.hasDraft ? <ReviewStatusBadge status={exercise.draftStatus || LessonVersionStatus.DRAFT} /> : exercise.publishedVersionNumber ? <Badge variant="success">Live</Badge> : null}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {exercises.length === 0 ? <li className="px-3 py-4 text-center text-xs text-muted-foreground">No exercises yet.</li> : null}
      </ul>
      {canAuthor ? (
        <button type="button" onClick={onAdd} className="flex items-center justify-center gap-1.5 border-t px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5">
          <Plus className="h-4 w-4" />
          Add exercise
        </button>
      ) : null}
    </div>
  );
}

export function ListeningTestsPage() {
  const { base, eyebrow, canAuthor, canManage } = useContentArea();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState(null);
  const [tests, setTests] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [newTest, setNewTest] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [adding, setAdding] = useState(null);
  const canEditTests = canAuthor || canManage;

  async function load() {
    setState('loading');
    try {
      const [list, topicList, testList] = await Promise.all([listListeningExercises(), listListeningTopics(), listListeningTests()]);
      const toeic = topicList.data.topics.filter((topic) => topic.format === ListeningFormat.TOEIC);
      setExercises(list.data.exercises);
      setTopics(toeic);
      setTests(testList.data.tests);
      setTopicId((current) => (toeic.some((topic) => topic.id === current) ? current : toeic[0]?.id || null));
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the listening tests', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topic = topics.find((item) => item.id === topicId);
  const topicTests = tests.filter((test) => test.topicId === topicId);
  const exercisesOf = (testId) => exercises.filter((exercise) => exercise.test?.id === testId);

  async function run(action, success, failure) {
    try {
      await action();
      notify({ title: success });
      await load();
      return true;
    } catch (error) {
      notify({ title: failure, description: getApiErrorMessage(error), variant: 'destructive' });
      return false;
    }
  }

  async function createExercise(title) {
    try {
      const result = await createListeningExercise({ topicId: adding.test.topicId, testId: adding.test.id, title, kind: adding.kind.key });
      notify({ title: 'Exercise created' });
      navigate(`${base}/listening/${result.data.exercise.id}`);
    } catch (error) {
      notify({ title: 'Could not create the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Listening tests"
        description="Choose a topic, then add tests and the exercises of each part."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-1.5">
              <Link to={`${base}/listening/all`}>
                <ListTree className="h-4 w-4" />
                All exercises
              </Link>
            </Button>
            {canEditTests && topic ? (
              <Button className="gap-1.5" onClick={() => setNewTest(true)}>
                <Plus className="h-4 w-4" />
                New test
              </Button>
            ) : null}
          </div>
        }
      />

      {state === 'loading' ? (
        <RowsSkeleton rows={4} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : topics.length === 0 ? (
        <EmptyState icon={Headphones} title="No TOEIC topic yet" description="An Admin or a Content Manager adds a topic of type TOEIC parts first." />
      ) : (
        <>
          {topics.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic">
              {topics.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === topicId}
                  onClick={() => setTopicId(item.id)}
                  className={cn('rounded-full border px-3 py-1 text-sm font-medium transition-colors', item.id === topicId ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Topic: <span className="font-medium text-foreground">{topic?.name}</span>
            </p>
          )}

          {topicTests.length === 0 ? (
            <EmptyState icon={Headphones} title="No tests yet" description="Create Test 1 to start adding listening exercises." />
          ) : (
            topicTests.map((test) => {
              const own = exercisesOf(test.id);
              return (
                <div key={test.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="border-l-4 border-primary pl-2 text-lg font-semibold leading-tight">{test.name}</h2>
                    <span className="text-xs text-muted-foreground">
                      {own.length} exercise{own.length === 1 ? '' : 's'}
                    </span>
                    {canEditTests ? (
                      <span className="ml-auto flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Rename ${test.name}`} onClick={() => setRenaming(test)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${test.name}`} disabled={own.length > 0} title={own.length ? 'Move or delete its exercises first' : 'Delete'} onClick={() => setRemoving(test)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {LISTENING_TOEIC_KINDS.map((kind) => (
                      <PartColumn key={kind.key} kind={kind} base={base} canAuthor={canAuthor} exercises={own.filter((exercise) => exercise.kind === kind.key)} onAdd={() => setAdding({ test, kind })} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      <NameDialog
        open={newTest}
        title={`New test in ${topic?.name || 'the topic'}`}
        description="For example: Test 1."
        label="Test name"
        initial={`Test ${topicTests.length + 1}`}
        onOpenChange={setNewTest}
        onSave={async (name) => (await run(() => createListeningTest(topicId, name), 'Test created', 'Could not create the test')) && setNewTest(false)}
      />
      <NameDialog
        open={Boolean(renaming)}
        title="Rename test"
        description="The new name shows to teachers and learners."
        label="Test name"
        initial={renaming?.name || ''}
        submitLabel="Save"
        onOpenChange={(open) => !open && setRenaming(null)}
        onSave={async (name) => (await run(() => updateListeningTest(renaming.id, name), 'Test renamed', 'Could not rename the test')) && setRenaming(null)}
      />
      <NameDialog
        open={Boolean(adding)}
        title={adding ? `New exercise · ${adding.test.name} · Part ${adding.kind.number}` : 'New exercise'}
        description="Each exercise has one recording; add it on the next page."
        label="Exercise title"
        initial={adding ? `Exercise ${exercisesOf(adding.test.id).filter((exercise) => exercise.kind === adding.kind.key).length + 1}` : ''}
        onOpenChange={(open) => !open && setAdding(null)}
        onSave={createExercise}
      />
      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>The test has no exercises; it disappears from the list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (event) => {
                event.preventDefault();
                if (await run(() => deleteListeningTest(removing.id), 'Test deleted', 'Could not delete the test')) setRemoving(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

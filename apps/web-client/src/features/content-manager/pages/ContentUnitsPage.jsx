import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Library, Pencil, Plus } from 'lucide-react';
import { MIN_PUBLISHED_LESSONS_PER_UNIT, UnitStatus } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../hooks/use-toast.js';
import {
  createLesson,
  createUnit,
  listUnits,
  publishUnit,
  updateLesson,
  updateUnit,
} from '../api/content-api.js';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';

function MoveButtons({ label, index, count, onMove, disabled }) {
  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move ${label} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(index)}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move ${label} down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index + 2)}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LessonBadges({ lesson }) {
  return (
    <div className="flex flex-wrap gap-2">
      {lesson.publishedVersionNumber ? (
        <Badge variant="success">Published v{lesson.publishedVersionNumber}</Badge>
      ) : (
        <Badge variant="outline">Not published</Badge>
      )}
      {lesson.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
    </div>
  );
}

export function ContentUnitsPage() {
  const { toast } = useToast();
  const [units, setUnits] = useState([]);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [lessonTitles, setLessonTitles] = useState({});
  const [editing, setEditing] = useState(null);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setUnits((await listUnits()).data.units);
      setState('ready');
    } catch (error) {
      setState('error');
      toast({
        title: 'Could not load content',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Runs one change, then reloads the list so positions and badges stay true.
  async function run(action, { success, failure }) {
    setBusy(true);
    try {
      await action();
      if (success) toast({ title: success });
      await load({ quiet: true });
      return true;
    } catch (error) {
      const issues = error?.response?.data?.data?.issues;
      toast({
        title: failure,
        description: issues?.[0]?.message || getApiErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addUnit(event) {
    event.preventDefault();
    const title = newUnitTitle.trim();
    if (!title) return;
    if (await run(() => createUnit({ title }), { success: 'Unit created', failure: 'Could not create the unit' }))
      setNewUnitTitle('');
  }

  async function addLesson(event, unit) {
    event.preventDefault();
    const title = (lessonTitles[unit.id] || '').trim();
    if (!title) return;
    if (await run(() => createLesson(unit.id, { title }), { success: 'Lesson created', failure: 'Could not create the lesson' }))
      setLessonTitles({ ...lessonTitles, [unit.id]: '' });
  }

  async function saveUnitDetails() {
    const { id, title, description } = editing;
    if (!title.trim()) return;
    if (await run(() => updateUnit(id, { title: title.trim(), description: description.trim() }), { success: 'Unit updated', failure: 'Could not update the unit' }))
      setEditing(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Units and lessons"
        description={`Learners see a unit once it is published, and only its published lessons. A unit needs at least ${MIN_PUBLISHED_LESSONS_PER_UNIT} published lesson${MIN_PUBLISHED_LESSONS_PER_UNIT === 1 ? '' : 's'}.`}
      />

      <form onSubmit={addUnit} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row">
        <Input
          aria-label="New unit title"
          placeholder="New unit title"
          value={newUnitTitle}
          maxLength={200}
          onChange={(event) => setNewUnitTitle(event.target.value)}
        />
        <Button type="submit" disabled={busy || !newUnitTitle.trim()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add unit
        </Button>
      </form>

      {state === 'loading' ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : state === 'error' ? (
        <Button variant="outline" onClick={() => load()}>Try again</Button>
      ) : units.length === 0 ? (
        <EmptyState icon={Library} title="No units yet" description="Add the first unit above." />
      ) : (
        units.map((unit, unitIndex) => {
          const publishedLessons = unit.lessons.filter((lesson) => lesson.publishedVersionNumber).length;
          const isPublished = unit.status === UnitStatus.PUBLISHED;
          return (
            <Card key={unit.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-xl">
                      Unit {unit.position}: {unit.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant={isPublished ? 'success' : 'outline'}>
                        {isPublished ? 'Published' : 'Draft'}
                      </Badge>
                      <span>
                        {publishedLessons} of {unit.lessons.length} lessons published
                      </span>
                    </div>
                    {unit.description ? (
                      <p className="text-sm text-muted-foreground">{unit.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <MoveButtons
                      label={`unit ${unit.title}`}
                      index={unitIndex}
                      count={units.length}
                      disabled={busy}
                      onMove={(position) =>
                        run(() => updateUnit(unit.id, { position }), { failure: 'Could not move the unit' })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit unit ${unit.title}`}
                      onClick={() => setEditing({ id: unit.id, title: unit.title, description: unit.description })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isPublished ? null : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => publishUnit(unit.id), { success: 'Unit published', failure: 'Unit cannot be published yet' })
                        }
                      >
                        Publish unit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {unit.lessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lessons in this unit yet.</p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {unit.lessons.map((lesson, lessonIndex) => (
                      <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-muted/50">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <span className="text-sm text-muted-foreground">{lesson.position}.</span>
                          <Link
                            to={`/content-manager/lessons/${lesson.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {lesson.title}
                          </Link>
                          <LessonBadges lesson={lesson} />
                        </div>
                        <MoveButtons
                          label={`lesson ${lesson.title}`}
                          index={lessonIndex}
                          count={unit.lessons.length}
                          disabled={busy}
                          onMove={(position) =>
                            run(() => updateLesson(lesson.id, { position }), { failure: 'Could not move the lesson' })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={(event) => addLesson(event, unit)} className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    aria-label={`New lesson title for unit ${unit.title}`}
                    placeholder="New lesson title"
                    value={lessonTitles[unit.id] || ''}
                    maxLength={200}
                    onChange={(event) => setLessonTitles({ ...lessonTitles, [unit.id]: event.target.value })}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={busy || !(lessonTitles[unit.id] || '').trim()}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add lesson
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>
              Changes to the title and description are visible to learners
              immediately when the unit is published.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unit-title">Title</Label>
              <Input
                id="unit-title"
                value={editing?.title || ''}
                maxLength={200}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-description">Description</Label>
              <Textarea
                id="unit-description"
                value={editing?.description || ''}
                maxLength={2000}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveUnitDetails} disabled={busy || !editing?.title.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

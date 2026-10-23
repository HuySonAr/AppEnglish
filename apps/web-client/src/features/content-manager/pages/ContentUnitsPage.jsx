import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, ClipboardCheck, Library, Pencil, Plus, X } from 'lucide-react';
import { UnitStatus } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  createLesson,
  createUnit,
  deleteUnit,
  listUnits,
  publishUnit,
  unpublishUnit,
  updateLesson,
  updateUnit,
} from '../api/content-api.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';
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
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { paginate } from '../../../lib/list.js';
import {
  LessonSort,
  StatusFilter,
  filterUnits,
  isReorderable,
  lessonSortOptions,
  statusOptions,
} from '../lib/content-list.js';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { useFocusReturn, useListLinkState, useReturnTo } from '../../../hooks/use-return-to.js';

function MoveButtons({ label, index, count, onMove, disabled }) {
  return (
    <div className="flex">
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${label} up`} disabled={disabled || index === 0} onClick={() => onMove(index)}>
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${label} down`} disabled={disabled || index === count - 1} onClick={() => onMove(index + 2)}>
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LessonRow({ lesson, index, count, linkState, unitId, busy, reorderable, onMove }) {
  return (
    <li className="group flex items-center gap-2 pr-2 transition-colors hover:bg-accent">
      <Link
        to={`/content-manager/lessons/${lesson.id}`}
        state={linkState(unitId)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">{lesson.position}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{lesson.title}</span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {lesson.hasDraft ? <Badge variant="warning">Draft</Badge> : null}
          {lesson.publishedVersionNumber ? <Badge variant="success">Published v{lesson.publishedVersionNumber}</Badge> : <Badge variant="outline">Not published</Badge>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      <MoveButtons label={`lesson ${lesson.title}`} index={index} count={count} disabled={busy || !reorderable} onMove={onMove} />
    </li>
  );
}

function AddLessonForm({ unit, busy, onAdd }) {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (title.trim() && (await onAdd(title.trim()))) setTitle('');
      }}
      className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2.5"
    >
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        aria-label={`New lesson title for unit ${unit.title}`}
        placeholder="Add a lesson"
        value={title}
        maxLength={200}
        className="h-9 border-dashed bg-transparent"
        onChange={(event) => setTitle(event.target.value)}
      />
      {title.trim() ? (
        <Button type="submit" size="sm" disabled={busy}>
          Add
        </Button>
      ) : null}
    </form>
  );
}

const UNITS_PER_PAGE = 5;
const DEFAULTS = { search: '', status: StatusFilter.ALL, sort: LessonSort.ORDER };

export function ContentUnitsPage() {
  const [units, setUnits] = useState([]);
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const publish = usePublishAction();
  const [publishingUnitId, setPublishingUnitId] = useState(null);
  const [creating, setCreating] = useState(null);
  const [editing, setEditing] = useState(null);
  const linkState = useListLinkState();
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setUnits((await listUnits()).data.units);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load content', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);
  useFocusReturn(state === 'ready');

  async function run(action, { success, failure }) {
    setBusy(true);
    try {
      await action();
      if (success) notify({ title: success });
      await load({ quiet: true });
      return true;
    } catch (error) {
      const issues = error?.response?.data?.data?.issues;
      notify({ title: failure, description: issues?.[0]?.message || getApiErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addUnit(event) {
    event.preventDefault();
    const title = creating.trim();
    if (title && (await run(() => createUnit({ title }), { success: 'Unit created', failure: 'Could not create the unit' }))) setCreating(null);
  }

  async function saveUnitDetails() {
    const { id, title, description } = editing;
    if (!title.trim()) return;
    if (await run(() => updateUnit(id, { title: title.trim(), description: description.trim() }), { success: 'Unit updated', failure: 'Could not update the unit' }))
      setEditing(null);
  }

  const reorderable = isReorderable(filters);
  const shown = paginate(filterUnits(units, filters), page, UNITS_PER_PAGE);
  const narrowed = filters.search || filters.status !== StatusFilter.ALL || filters.sort !== LessonSort.ORDER;
  const lessonTotal = units.reduce((sum, unit) => sum + unit.lessonCount, 0);
  const newButton = (
    <Button className="gap-2" disabled={state !== 'ready'} onClick={() => setCreating('')}>
      <Plus className="h-4 w-4" />
      New unit
    </Button>
  );

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Content Manager" title="Units and lessons" description="Create, order and publish units and their lessons." actions={newButton} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} tall />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      ) : units.length === 0 ? (
        <EmptyState icon={Library} title="No units yet" description="Create the first unit." action={newButton} />
      ) : (
        <>
          <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search units and lessons" />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <FilterSelect label="Lesson status" value={filters.status} onChange={setFilter('status')} options={statusOptions} className="w-full sm:w-40" />
                <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={lessonSortOptions} className="w-full sm:w-44" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {units.length} unit{units.length === 1 ? '' : 's'} · {lessonTotal} lesson{lessonTotal === 1 ? '' : 's'}
                {reorderable ? '' : ' · reordering is off while filtering'}
              </span>
              {narrowed ? (
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setFilters(DEFAULTS)}>
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          {shown.total === 0 ? (
            <EmptyState icon={Library} title="Nothing matches" description="Try another search or filter." />
          ) : (
            <div className="space-y-4">
              {shown.items.map((unit) => {
                const unitIndex = units.findIndex((item) => item.id === unit.id);
                const isPublished = unit.status === UnitStatus.PUBLISHED;
                const share = unit.lessonCount ? (unit.publishedCount * 100) / unit.lessonCount : 0;
                return (
                  <article key={unit.id} id={`focus-${unit.id}`} className="scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-sm">
                    <header className="flex flex-wrap items-start gap-4 p-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 leading-none text-primary">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Unit</span>
                        <span className="text-xl font-bold tabular-nums">{unit.position}</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold">{unit.title}</h2>
                          <Badge variant={isPublished ? 'success' : 'outline'}>{isPublished ? 'Published' : 'Not published'}</Badge>
                        </div>
                        {unit.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{unit.description}</p> : null}
                        <div className="flex max-w-sm items-center gap-2 text-xs text-muted-foreground">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <span className="block h-full rounded-full bg-success" style={{ width: `${share}%` }} />
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {unit.publishedCount}/{unit.lessonCount} lessons published
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MoveButtons
                          label={`unit ${unit.title}`}
                          index={unitIndex}
                          count={units.length}
                          disabled={busy || !reorderable}
                          onMove={(position) => run(() => updateUnit(unit.id, { position }), { failure: 'Could not move the unit' })}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit unit ${unit.title}`} onClick={() => setEditing({ id: unit.id, title: unit.title, description: unit.description || '' })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isPublished ? null : (
                          <PublishButton
                            size="sm"
                            label="Publish unit"
                            state={publishingUnitId === unit.id ? publish.state : 'idle'}
                            disabled={busy}
                            onClick={() => {
                              setPublishingUnitId(unit.id);
                              publish.run(() => run(() => publishUnit(unit.id), { success: 'Unit published', failure: 'Unit cannot be published yet' }));
                            }}
                          />
                        )}
                        <ContentDangerActions
                          noun="unit"
                          published={isPublished}
                          busy={busy}
                          onUnpublish={async () => {
                            await unpublishUnit(unit.id);
                            await load({ quiet: true });
                          }}
                          onDelete={async () => {
                            await deleteUnit(unit.id);
                            await load({ quiet: true });
                          }}
                          deleteNote="Every lesson of the unit goes with it."
                        />
                      </div>
                    </header>

                    <div className="border-t">
                      {unit.lessons.length === 0 ? (
                        <p className="px-4 py-5 text-center text-sm text-muted-foreground">{unit.lessonCount ? 'No lesson of this unit matches.' : 'No lesson yet.'}</p>
                      ) : (
                        <ul className="divide-y">
                          {unit.lessons.map((lesson, lessonIndex) => (
                            <LessonRow
                              key={lesson.id}
                              lesson={lesson}
                              index={lessonIndex}
                              count={unit.lessons.length}
                              linkState={linkState}
                              unitId={unit.id}
                              busy={busy}
                              reorderable={reorderable}
                              onMove={(position) => run(() => updateLesson(lesson.id, { position }), { failure: 'Could not move the lesson' })}
                            />
                          ))}
                        </ul>
                      )}
                      <Link
                        to={`/content-manager/units/${unit.id}/review`}
                        state={linkState(unit.id)}
                        className="group flex items-center gap-3 border-t px-4 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-info/10 text-info">
                          <ClipboardCheck className="h-4 w-4" />
                        </span>
                        <span className="flex-1 font-medium">Unit review</span>
                        {unit.review?.publishedVersionNumber ? (
                          <Badge variant="success">Published v{unit.review.publishedVersionNumber}</Badge>
                        ) : unit.review?.hasDraft ? (
                          <Badge variant="warning">Draft</Badge>
                        ) : (
                          <Badge variant="outline">Not written</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <AddLessonForm
                        unit={unit}
                        busy={busy}
                        onAdd={(title) => run(() => createLesson(unit.id, { title }), { success: 'Lesson created', failure: 'Could not create the lesson' })}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="unit" onChange={setPage} />
        </>
      )}

      <Dialog open={creating !== null} onOpenChange={(open) => !open && !busy && setCreating(null)}>
        <DialogContent>
          <form onSubmit={addUnit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New unit</DialogTitle>
              <DialogDescription>Add its lessons after creating it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-unit-title">Title</Label>
              <Input id="new-unit-title" autoFocus value={creating || ''} maxLength={200} onChange={(event) => setCreating(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={busy || !creating?.trim()}>
                Create unit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>Learners see the change once the unit is published.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="unit-title">Title</Label>
              <Input id="unit-title" value={editing?.title || ''} maxLength={200} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-description">Description</Label>
              <Textarea id="unit-description" value={editing?.description || ''} maxLength={2000} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={saveUnitDetails} disabled={busy || !editing?.title.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

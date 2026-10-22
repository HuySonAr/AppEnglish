import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, ClipboardCheck, Lock, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LessonState, UnitReviewState } from '@appenglish/learning-contracts';
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
import { useListState } from '../../../hooks/use-list-state.js';
import { useFocusReturn, useListLinkState } from '../../../hooks/use-return-to.js';
import { getCurriculum } from '../api/lessons-api.js';
import { filterCurriculum, lessonStateOptions, nextLesson, unitProgress } from '../lib/student-list.js';

const UNITS_PER_PAGE = 5;

function Node({ tone, children, last }) {
  return (
    <span className="relative flex w-10 shrink-0 justify-center self-stretch">
      {last ? null : <span aria-hidden="true" className="absolute left-1/2 top-10 h-[calc(100%-1.25rem)] w-0.5 -translate-x-1/2 bg-border" />}
      <span className={cn('relative z-[1] mt-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-card', tone)}>{children}</span>
    </span>
  );
}

function PathRow({ to, linkState, locked, tone, node, title, detail, last, current }) {
  const body = (
    <>
      <Node tone={tone} last={last}>
        {node}
      </Node>
      <span className="min-w-0 flex-1 py-2">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          {current ? <Badge variant="info">Next</Badge> : null}
        </span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
      {locked ? null : <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const frame = 'flex items-start gap-3 rounded-xl px-2 py-1';
  return (
    <li>
      {locked ? (
        <div className={cn(frame, 'opacity-60')} aria-disabled="true">
          {body}
        </div>
      ) : (
        <Link to={to} state={linkState} className={cn(frame, 'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', current && 'bg-primary/5')}>
          {body}
        </Link>
      )}
    </li>
  );
}

function lessonRow(lesson, unit, linkState, next, last) {
  const locked = lesson.state === LessonState.LOCKED;
  const completed = lesson.state === LessonState.COMPLETED;
  return (
    <PathRow
      key={lesson.id}
      to={`/student/lessons/${lesson.id}`}
      linkState={linkState}
      locked={locked}
      last={last}
      current={next?.lesson?.id === lesson.id}
      tone={completed ? 'bg-success text-white' : locked ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}
      node={completed ? <CheckCircle2 className="h-5 w-5" /> : locked ? <Lock className="h-4 w-4" /> : lesson.number}
      title={`Lesson ${lesson.number}: ${lesson.title}`}
      detail={`${completed ? 'Completed' : locked ? 'Locked' : 'Open'}${lesson.bestPercent === null ? '' : ` · best ${lesson.bestPercent}%`}`}
    />
  );
}

function reviewRow(unit, linkState, next) {
  const { review } = unit;
  const locked = review.state === UnitReviewState.LOCKED;
  const passed = review.state === UnitReviewState.PASSED;
  return (
    <PathRow
      key="review"
      to={`/student/units/${unit.id}/review`}
      linkState={linkState}
      locked={locked}
      last
      current={next?.type === 'review' && next.unit.id === unit.id}
      tone={passed ? 'bg-success text-white' : locked ? 'bg-muted text-muted-foreground' : 'bg-warning text-white'}
      node={passed ? <Trophy className="h-4 w-4" /> : locked ? <Lock className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
      title={`Unit review · ${review.questionCount} questions`}
      detail={passed ? `Passed${review.bestPercent === null ? '' : ` · best ${review.bestPercent}%`}` : locked ? 'After the last lesson' : `${review.passPercent}% to pass${review.bestPercent === null ? '' : ` · best ${review.bestPercent}%`}`}
    />
  );
}

export function LessonsPage() {
  const [state, setState] = useState('loading');
  const [curriculum, setCurriculum] = useState(null);
  const linkState = useListLinkState();
  const { filters, setFilter, page, setPage } = useListState({ search: '', state: 'all' });

  async function load() {
    setState('loading');
    try {
      setCurriculum((await getCurriculum()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the lessons', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);
  useFocusReturn(state === 'ready');

  if (state === 'loading') return <ListPageSkeleton rows={6} />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const shown = paginate(filterCurriculum(curriculum.units, filters), page, UNITS_PER_PAGE);
  const next = curriculum.placementRequired ? null : nextLesson(curriculum.units);
  const allLessons = curriculum.units.flatMap((unit) => unit.lessons);
  const completed = allLessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
  const fullUnit = (id) => curriculum.units.find((unit) => unit.id === id);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Learn" title="Lessons" description="Pass a lesson's test to open the next one." />

      {curriculum.placementRequired ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Start with the placement test</p>
            <p className="text-sm text-muted-foreground">Take it, or skip it, to open your first lesson.</p>
          </div>
          <Button asChild>
            <Link to="/student/placement">Go to the placement test</Link>
          </Button>
        </div>
      ) : null}

      {curriculum.units.length ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          {next ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Continue · Unit {next.unit.number}
                </p>
                <p className="truncate text-lg font-semibold">{next.type === 'review' ? `Unit review: ${next.unit.title}` : `Lesson ${next.lesson.number}: ${next.lesson.title}`}</p>
              </div>
              <Button asChild size="lg" className="gap-1.5">
                <Link to={next.type === 'review' ? `/student/units/${next.unit.id}/review` : `/student/lessons/${next.lesson.id}`} state={linkState(next.unit.id)}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-sm">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <p className="font-medium">{curriculum.placementRequired ? 'Your lessons open after the placement test.' : 'Every open lesson is done.'}</p>
            </div>
          )}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Lessons completed</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {completed}
              <span className="text-lg font-normal text-muted-foreground">/{allLessons.length}</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${allLessons.length ? (completed * 100) / allLessons.length : 0}%` }} />
            </div>
          </div>
        </div>
      ) : null}

      {curriculum.units.length === 0 ? (
        <EmptyState icon={BookOpen} title="No lessons yet" description="Lessons will appear here when they are published." />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search units and lessons by title" />
            <FilterSelect label="Lesson state" value={filters.state} onChange={setFilter('state')} options={lessonStateOptions} />
          </div>
          {shown.total === 0 ? <EmptyState icon={BookOpen} title="No lesson matches" description="Try another search or filter." /> : null}
          {shown.items.map((unit) => {
            const progress = unitProgress(fullUnit(unit.id) || unit);
            return (
              <div key={unit.id} id={`focus-${unit.id}`} className="scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-center gap-4 border-b px-5 py-4">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold', progress.complete ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary')}>
                    {progress.complete ? <CheckCircle2 className="h-6 w-6" /> : unit.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold">
                      Unit {unit.number}: {unit.title}
                    </h2>
                    {unit.description ? <p className="truncate text-sm text-muted-foreground">{unit.description}</p> : null}
                  </div>
                  <div className="flex w-full items-center gap-3 sm:w-48">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress.total ? (progress.done * 100) / progress.total : 0}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  {curriculum.startUnit === unit.number ? <Badge variant="info">Your starting unit</Badge> : null}
                </div>
                {unit.lessons.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">No lessons in this unit yet.</p>
                ) : (
                  <ol className="space-y-1 p-3">
                    {unit.lessons.map((lesson, index) => lessonRow(lesson, unit, linkState(unit.id), next, index === unit.lessons.length - 1 && !unit.review))}
                    {unit.review ? reviewRow(unit, linkState(unit.id), next) : null}
                  </ol>
                )}
              </div>
            );
          })}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="unit" onChange={setPage} />
        </>
      )}
    </section>
  );
}

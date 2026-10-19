import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, ChevronRight, ClipboardCheck, Compass, GraduationCap, Lock, NotebookPen, PlayCircle, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COURSE_SECTION_TITLES } from '@appenglish/content-contracts';
import { CourseItemState, CourseLevelState, CoursePlacementStatus } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getListeningCourse, skipCoursePlacement } from '../api/course-api.js';
import {
  CourseLessonFilter,
  courseLessonFilterOptions,
  courseLessonPath,
  courseTestPath,
  filterCourseUnits,
  levelProgress,
  nextKind,
  nextPath,
  startingLevel,
} from '../lib/listening-course.js';

const UNITS_PER_PAGE = 5;

// One row of the course: a lesson, a unit check or a level test, a link
// unless it is locked.
function CourseRow({ to, state, marker, title, detail, className }) {
  const locked = state === CourseItemState.LOCKED;
  const passed = state === CourseItemState.PASSED;
  const body = (
    <>
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          passed ? 'bg-success/15 text-success' : locked ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
      >
        {passed ? <CheckCircle2 className="h-5 w-5" /> : locked ? <Lock className="h-4 w-4" /> : marker}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
      {locked ? null : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const frame = cn('flex items-center gap-4 px-4 py-3', className);
  return locked ? (
    <div className={cn(frame, 'opacity-60')} aria-disabled="true">
      {body}
    </div>
  ) : (
    <Link
      to={to}
      className={cn(
        frame,
        'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      {body}
    </Link>
  );
}

// "Passed · best 80%", "Not passed yet · best 40%", "Locked"…
function resultText(item, lockedText) {
  if (item.state === CourseItemState.LOCKED) return lockedText;
  const state = item.passed ? 'Passed' : item.attemptCount ? 'Not passed yet' : 'Not started';
  return `${state}${item.bestScore === null ? '' : ` · best ${item.bestScore}%`}`;
}

// The Listening course (F05C, D100–D103, D107): by CEFR level, the units
// (grouped by section, Social and Travel then Work and Study) with their
// lessons and unit check, and the level test; the learner's level, what is
// open, their best scores and the next thing to do. Until the listening
// placement is taken or skipped, it is offered at the top.
export function ListeningCoursePage() {
  const [state, setState] = useState('loading');
  const [course, setCourse] = useState(null);
  const [level, setLevel] = useState(null);
  // Search and filter of the level's units; changing one goes back to page 1.
  const [filters, setFilters] = useState({
    search: '',
    status: CourseLessonFilter.ALL,
  });
  const [page, setPage] = useState(1);
  const [skipping, setSkipping] = useState(false);
  const setFilter = (name) => (value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  async function skipPlacement() {
    setSkipping(true);
    try {
      await skipCoursePlacement();
      notify({ title: 'You start at A1' });
      const data = (await getListeningCourse()).data;
      setCourse(data);
    } catch (error) {
      notify({
        title: 'Could not skip the placement',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSkipping(false);
    }
  }

  async function load() {
    setState('loading');
    try {
      const data = (await getListeningCourse()).data;
      setCourse(data);
      setLevel((current) => current || startingLevel(data));
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the listening course',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <ListPageSkeleton rows={6} />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const header = (
    <PageHeader
      eyebrow="Learn"
      title="Listening course"
      description={`Raise your listening level from A1 to C1. Pass each lesson with ${course.passPercent.lesson}% to open the next one, the unit check with ${course.passPercent.unitCheck}%, and the level test with ${course.passPercent.levelTest}% to move up.`}
      actions={
        <>
          {course.currentLevel ? <Badge variant="info">Your level: {course.currentLevel}</Badge> : null}
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/student/listening-course/progress">
              <BarChart3 className="h-4 w-4" />
              My progress
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/student/listening-course/mistakes">
              <NotebookPen className="h-4 w-4" />
              My mistakes
            </Link>
          </Button>
        </>
      }
    />
  );
  if (!course.levels.some((item) => item.units.length || item.levelTest))
    return (
      <section className="space-y-6">
        {header}
        <EmptyState icon={GraduationCap} title="No lessons yet" description="Listening lessons will appear here when they are published." />
      </section>
    );

  const { next } = course;
  const current = course.levels.find((item) => item.level === level) || course.levels[0];
  const previous = course.levels[course.levels.indexOf(current) - 1];
  const shown = paginate(filterCourseUnits(current.units, filters), page, UNITS_PER_PAGE);
  // Lessons are numbered within their unit, whatever the filter shows.
  const numberOf = (unitId, lessonId) => current.units.find((unit) => unit.id === unitId).lessons.findIndex((item) => item.id === lessonId) + 1;

  return (
    <section className="space-y-6">
      {header}

      {course.placement.status === CoursePlacementStatus.NOT_STARTED && course.placement.available ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <Compass className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Find your level first</p>
              <p className="text-sm text-muted-foreground">Take the listening placement once to start at the right level, or start at A1.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild>
              <Link to="/student/listening-course/placement">Take the placement</Link>
            </Button>
            <Button variant="outline" loading={skipping} disabled={skipping} onClick={skipPlacement}>
              Start at A1
            </Button>
          </div>
        </div>
      ) : null}

      {next ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {nextKind[next.type]} · {next.level}
            </p>
            <p className="truncate font-semibold">{next.title}</p>
            {next.type === 'lesson' ? <p className="truncate text-sm text-muted-foreground">{next.unitTitle}</p> : null}
          </div>
          <Button asChild className="gap-1.5">
            <Link to={nextPath(next)}>
              <PlayCircle className="h-4 w-4" />
              Continue
            </Link>
          </Button>
        </div>
      ) : course.currentLevel ? (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-semibold">Nothing more to take at {course.currentLevel} yet</p>
          <p className="text-sm text-muted-foreground">New lessons and the level test will appear here when they are published.</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-5">
          <Trophy className="h-6 w-6 shrink-0 text-success" />
          <div>
            <p className="font-semibold">You have passed every level test</p>
            <p className="text-sm text-muted-foreground">Every lesson stays open for review.</p>
          </div>
        </div>
      )}

      <Tabs
        value={current.level}
        onValueChange={(value) => {
          setLevel(value);
          setPage(1);
        }}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          {course.levels.map((item) => {
            const progress = levelProgress(item);
            return (
              <TabsTrigger key={item.level} value={item.level} className="gap-1.5">
                {item.state === CourseLevelState.LOCKED ? <Lock className="h-3 w-3" aria-label="Locked" /> : null}
                {item.state === CourseLevelState.DONE ? <CheckCircle2 className="h-3 w-3 text-success" aria-label="Passed" /> : null}
                {item.level}
                {progress.total ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {progress.passed}/{progress.total}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {current.state === CourseLevelState.LOCKED ? (
        <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" />
          {previous ? `Pass the ${previous.level} level test to open ${current.level}.` : `${current.level} is locked.`}
        </p>
      ) : current.state === CourseLevelState.DONE ? (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          You are past {current.level}: every lesson is open for review.
        </p>
      ) : null}

      {current.units.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={`No ${current.level} lessons yet`}
          description="Lessons of this level will appear here when they are published."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search units and lessons by title" />
            <FilterSelect label="Lesson state" value={filters.status} onChange={setFilter('status')} options={courseLessonFilterOptions} />
          </div>
          {shown.total === 0 ? <EmptyState icon={GraduationCap} title="No lesson matches" description="Try another search or filter." /> : null}
          {shown.items.map((unit, index) => (
            <div key={unit.id} className="space-y-3">
              {unit.section && unit.section !== shown.items[index - 1]?.section ? (
                <h2 className="pt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {COURSE_SECTION_TITLES[unit.section] || unit.section}
                </h2>
              ) : null}
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="border-b bg-muted/40 px-4 py-3">
                  <h2 className="truncate font-semibold">{unit.title}</h2>
                  {unit.description ? <p className="text-sm text-muted-foreground">{unit.description}</p> : null}
                </div>
                <ul className="divide-y">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <CourseRow
                        to={courseLessonPath(unit.id, lesson.id)}
                        state={lesson.state}
                        marker={numberOf(unit.id, lesson.id)}
                        title={lesson.title}
                        detail={resultText(lesson, 'Locked: pass the lesson before it')}
                      />
                    </li>
                  ))}
                </ul>
                <CourseRow
                  to={courseTestPath(unit.id)}
                  state={unit.check.state}
                  marker={<ClipboardCheck className="h-4 w-4" />}
                  title="Unit check"
                  detail={`${unit.check.questionCount} questions · ${resultText(unit.check, 'opens when every lesson of the unit is passed')}`}
                  className="border-t"
                />
              </div>
            </div>
          ))}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="unit" onChange={setPage} />
        </>
      )}

      {current.levelTest ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{current.level} level test</h2>
            <span className="ml-auto text-sm text-muted-foreground">Pass with {course.passPercent.levelTest}% to move up</span>
          </div>
          <CourseRow
            to={courseTestPath(current.levelTest.id)}
            state={current.levelTest.state}
            marker={<Trophy className="h-4 w-4" />}
            title={current.levelTest.title}
            detail={`${current.levelTest.questionCount} questions · ${resultText(current.levelTest, 'Locked')}${
              current.state === CourseLevelState.CURRENT && !current.levelTest.passed ? ' · you can take it at any time' : ''
            }`}
          />
        </div>
      ) : current.state === CourseLevelState.CURRENT ? (
        <p className="text-sm text-muted-foreground">The {current.level} level test is not published yet.</p>
      ) : null}
    </section>
  );
}

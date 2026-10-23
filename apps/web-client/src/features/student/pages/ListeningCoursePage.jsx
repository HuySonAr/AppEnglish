import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, Circle, GraduationCap, Headphones, Lock, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Tabs, TabsList, TabsTrigger } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { ListPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { useFocusReturn, useListLinkState } from '../../../hooks/use-return-to.js';
import { getListeningCourse } from '../api/course-api.js';
import {
  CourseTopicFilter,
  courseTestPath,
  courseTopicFilterOptions,
  courseTopicPath,
  filterTopics,
  isOpen,
  levelProgress,
  nextKind,
  nextStep,
  startingLevel,
} from '../lib/listening-course.js';

const PAGE_SIZE = 10;

function LevelTestCard({ level, passPercent, linkState }) {
  const test = level.levelTest;
  if (!test)
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        {level.level === 'C2' ? 'C2 is the last level of the course.' : `The ${level.level} test is not ready yet; the next level opens with it.`}
      </div>
    );
  return (
    <div id={`focus-${test.id}`} className={cn('flex scroll-mt-24 flex-wrap items-center gap-4 rounded-xl border p-4 shadow-sm', test.passed ? 'border-success/40 bg-success/5' : 'bg-card')}>
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', test.passed ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary')}>
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{test.title}</p>
        <p className="text-sm text-muted-foreground">
          {test.passed
            ? `Passed${test.nextLevel ? `: ${test.nextLevel} is open` : ''}. Best score ${test.bestScore}%.`
            : `${test.questionCount} questions · ${passPercent.levelTest}% opens ${test.nextLevel || 'the next level'} · take it whenever you are ready${test.attemptCount ? ` · best ${test.bestScore}%` : ''}`}
        </p>
      </div>
      <Button asChild variant={test.passed ? 'outline' : 'default'} className="gap-1.5">
        <Link to={courseTestPath(test.id)} state={linkState(test.id)}>
          {test.passed ? 'Take it again' : test.attemptCount ? 'Try again' : 'Take the test'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export function ListeningCoursePage() {
  const [state, setState] = useState('loading');
  const [course, setCourse] = useState(null);
  const linkState = useListLinkState();
  const { filters, setFilter, setFilters, page, setPage } = useListState({ level: '', search: '', status: CourseTopicFilter.ALL });

  async function load() {
    setState('loading');
    try {
      setCourse((await getListeningCourse()).data);
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

  if (state === 'loading') return <ListPageSkeleton rows={6} />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const levelKey = filters.level || startingLevel(course);
  const level = course.levels.find((entry) => entry.level === levelKey) || course.levels[0];
  const next = nextStep(course);
  const found = filterTopics(level.topics, filters);
  const shown = paginate(found, page, PAGE_SIZE);
  const progress = levelProgress(level);
  const filtering = Boolean(filters.search.trim()) || filters.status !== CourseTopicFilter.ALL;
  const previous = course.levels[course.levels.findIndex((entry) => entry.level === level.level) - 1];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Listening"
        title="Listening course"
        description={`From A1 to C2. Study the topics of your level in any order; pass the level test (${course.passPercent.levelTest}%) to open the next level.`}
        actions={
          <Button asChild variant="outline" className="gap-1.5">
            <Link to="/student/listening-course/progress">
              <BarChart3 className="h-4 w-4" />
              My progress
            </Link>
          </Button>
        }
      />

      {next ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <Headphones className="h-6 w-6 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {nextKind[next.type]} · {next.level}
            </p>
            <p className="truncate font-semibold">{next.title}</p>
          </div>
          <Button asChild className="gap-1.5">
            <Link to={next.path}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      <Tabs value={level.level} onValueChange={(value) => setFilters({ level: value, search: '', status: CourseTopicFilter.ALL })}>
        <TabsList className="flex-wrap">
          {course.levels.map((entry) => (
            <TabsTrigger key={entry.level} value={entry.level} className="gap-1.5">
              {isOpen(entry) ? null : <Lock className="h-3.5 w-3.5" aria-label="locked" />}
              {entry.level}
              {entry.topics.length ? <span className="text-xs text-muted-foreground">{levelProgress(entry).done}/{entry.topics.length}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!isOpen(level) ? (
        <EmptyState
          icon={Lock}
          title={`${level.level} is locked`}
          description={previous ? `Pass the ${previous.level} level test to open ${level.level}.` : 'This level is not open yet.'}
          action={
            previous?.levelTest ? (
              <Button asChild>
                <Link to={courseTestPath(previous.levelTest.id)}>Take the {previous.level} test</Link>
              </Button>
            ) : null
          }
        />
      ) : level.topics.length === 0 ? (
        <>
          <EmptyState icon={GraduationCap} title={`No ${level.level} topic yet`} description="Topics appear here when they are published." />
          <LevelTestCard level={level} passPercent={course.passPercent} linkState={linkState} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField label="Search topics" placeholder={`Search ${level.level} topics`} value={filters.search} onChange={setFilter('search')} />
            <FilterSelect label="Topic state" value={filters.status} onChange={setFilter('status')} options={courseTopicFilterOptions} />
            <Badge variant="secondary" className="self-start sm:self-auto">
              {progress.done} of {progress.total} done
            </Badge>
          </div>
          {found.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No topic matches" description="Try another search or filter." />
          ) : (
            <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {shown.items.map((topic) => (
                <li key={topic.id} id={`focus-${topic.id}`} className="scroll-mt-24">
                  <Link to={courseTopicPath(topic.id)} state={linkState(topic.id)} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    {topic.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="done" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="not done" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {topic.position}. {topic.title}
                      </span>
                      {topic.description ? <span className="block truncate text-sm text-muted-foreground">{topic.description}</span> : null}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="topic" onChange={setPage} />
          {filtering ? null : <LevelTestCard level={level} passPercent={course.passPercent} linkState={linkState} />}
        </>
      )}
    </section>
  );
}

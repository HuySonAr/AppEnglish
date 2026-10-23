import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, Circle, ClipboardCheck, FileText, GraduationCap, Headphones, Library, PenLine, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, Skeleton } from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { greeting } from '../../student/lib/home.js';
import { getPlacementTest, listListeningCourse, listListeningExercises, listMockTests, listUnits } from '../api/content-api.js';
import { lessonState } from '../lib/lesson-draft.js';
import { contentSummary, courseCoverage, exercisesByLevel, lessonsByUnit, pendingDrafts, readinessChecks } from '../lib/dashboard.js';
import { OrphanMediaPanel } from '../components/OrphanMediaPanel.jsx';

const chartConfig = {
  published: { label: 'Published', color: 'hsl(var(--chart-1))' },
  unpublished: { label: 'Not published', color: 'hsl(var(--muted-foreground) / 0.35)' },
};

const tools = [
  { icon: Library, title: 'Units and lessons', to: '/content-manager/units' },
  { icon: ClipboardCheck, title: 'Placement test', to: '/content-manager/placement' },
  { icon: FileText, title: 'Mock tests', to: '/content-manager/mock-tests' },
  { icon: GraduationCap, title: 'Listening course', to: '/content-manager/listening-course' },
  { icon: Headphones, title: 'Listening exercises', to: '/content-manager/listening' },
  { icon: Tags, title: 'Listening topics', to: '/content-manager/listening-topics' },
];

function Panel({ title, description, to, linkLabel, className, children }) {
  return (
    <div className={cn('space-y-4 rounded-xl border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {to ? (
          <Button asChild variant="ghost" size="sm" className="-mr-2 -mt-1 shrink-0 gap-1">
            <Link to={to}>
              {linkLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, published, total, note, to }) {
  const share = total ? (published * 100) / total : 0;
  return (
    <Link to={to} className="group space-y-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {published}
        <span className="text-sm font-medium text-muted-foreground"> / {total} published</span>
      </p>
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="block h-full rounded-full bg-success" style={{ width: `${share}%` }} />
      </span>
      {note ? <p className="truncate text-xs text-muted-foreground">{note}</p> : null}
    </Link>
  );
}

function LessonsChart({ rows }) {
  const data = rows.map((row) => ({ ...row, name: row.title.length > 22 ? `${row.title.slice(0, 21).trimEnd()}…` : row.title }));
  return (
    <div className="overflow-x-auto">
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 36 + 40) }} role="img" aria-label={`Lessons per unit: ${rows.map((row) => `${row.title} ${row.published} of ${row.total} published`).join(', ')}`}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} fontSize={12} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="published" stackId="lessons" fill="var(--color-published)" isAnimationActive={false} barSize={16} />
          <Bar dataKey="unpublished" stackId="lessons" fill="var(--color-unpublished)" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={16}>
            <LabelList dataKey="total" position="right" offset={6} fontSize={11} className="fill-muted-foreground" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function ExercisesChart({ rows }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full" role="img" aria-label={`Listening exercises per level: ${rows.map((row) => `${row.level} ${row.published} of ${row.total}`).join(', ')}`}>
      <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="level" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="published" stackId="exercises" fill="var(--color-published)" isAnimationActive={false} maxBarSize={36} />
        <Bar dataKey="unpublished" stackId="exercises" fill="var(--color-unpublished)" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36}>
          <LabelList dataKey="total" position="top" offset={4} fontSize={11} className="fill-muted-foreground" formatter={(value) => (value ? value : '')} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const testBadge = {
  published: { variant: 'success', label: 'Test live' },
  draft: { variant: 'warning', label: 'Test draft' },
  missing: { variant: 'outline', label: 'No test' },
  none: { variant: 'secondary', label: 'Last level' },
};

function CourseLevels({ rows }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {rows.map((row) => (
        <li key={row.level} className={cn('space-y-2 rounded-lg border p-3', row.publishedTopics === 0 && 'border-dashed')}>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold">{row.level}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {row.publishedTopics}/{row.topics} topics
            </span>
          </p>
          <span className="block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full rounded-full bg-success" style={{ width: `${row.topics ? (row.publishedTopics * 100) / row.topics : 0}%` }} />
          </span>
          <Badge variant={testBadge[row.levelTest].variant}>{testBadge[row.levelTest].label}</Badge>
        </li>
      ))}
    </ol>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-[132px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

export function ContentManagerDashboardPage() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      const [unitsResult, mocks, listening, course, placement] = await Promise.all([
        listUnits(),
        listMockTests().catch(() => null),
        listListeningExercises().catch(() => null),
        listListeningCourse().catch(() => null),
        getPlacementTest().catch(() => null),
      ]);
      setData({
        units: unitsResult.data.units || [],
        mockTests: mocks?.data?.mockTests || [],
        exercises: listening?.data?.exercises || [],
        course: course?.data || null,
        placement: placement ? lessonState(placement.data) : null,
        partial: !mocks || !listening || !course || !placement,
      });
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the content overview', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const header = <PageHeader eyebrow="Content Manager" title={`${greeting()}.`} description="What learners still miss and what is waiting to be published." />;

  if (state === 'loading')
    return (
      <section className="space-y-6">
        {header}
        <DashboardSkeleton />
      </section>
    );
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const summary = contentSummary(data);
  const drafts = pendingDrafts(data);
  const checks = readinessChecks(data);
  const open = checks.filter((check) => !check.ok);
  const next = open[0];
  const unitRows = lessonsByUnit(data.units);
  const done = checks.length - open.length;

  return (
    <section className="space-y-6">
      {header}

      {data.partial ? <p className="text-sm text-muted-foreground">Some areas could not be loaded; reload to see all numbers.</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Ready for learners</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {done}
                <span className="text-base font-medium text-muted-foreground"> of {checks.length} checks</span>
              </p>
            </div>
            {next ? (
              <Button asChild className="gap-1.5">
                <Link to={next.to}>
                  Next step
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Badge variant="success">All set</Badge>
            )}
          </div>
          <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full rounded-full bg-success" style={{ width: `${(done * 100) / checks.length}%` }} />
          </span>
          <ul className="divide-y">
            {[...open, ...checks.filter((check) => check.ok)].map((check) => (
              <li key={check.key}>
                <Link to={check.to} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
                  {check.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Done" /> : <Circle className="h-4 w-4 shrink-0 text-warning" aria-label="Open" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', check.ok ? 'text-muted-foreground' : 'font-medium')}>{check.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{check.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Drafts waiting</h2>
            <Badge variant={drafts.length ? 'warning' : 'secondary'} className="tabular-nums">
              {drafts.length}
            </Badge>
          </div>
          {drafts.length ? (
            <ul className="divide-y">
              {drafts.slice(0, 8).map((draft) => (
                <li key={`${draft.kind}-${draft.id}`}>
                  <Link to={draft.to} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                      <PenLine className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{draft.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {draft.kind}
                        {draft.context ? ` · ${draft.context}` : ''}
                      </span>
                    </span>
                    <Badge variant={draft.published ? 'warning' : 'outline'}>{draft.published ? 'Update' : 'New'}</Badge>
                  </Link>
                </li>
              ))}
              {drafts.length > 8 ? <li className="pt-2 text-xs text-muted-foreground">and {drafts.length - 8} more</li> : null}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Every change is published.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Library} label="Lessons" published={summary.lessons.published} total={summary.lessons.total} note={`${summary.units.published}/${summary.units.total} units published`} to="/content-manager/units" />
        <Stat icon={FileText} label="Mock tests" published={summary.mockTests.published} total={summary.mockTests.total} to="/content-manager/mock-tests" />
        <Stat icon={Headphones} label="Listening exercises" published={summary.exercises.published} total={summary.exercises.total} to="/content-manager/listening" />
        <Stat icon={GraduationCap} label="Course topics" published={summary.courseTopics.published} total={summary.courseTopics.total} note={`${summary.levelTests.published}/${summary.levelTests.total} level tests published`} to="/content-manager/listening-course" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Lessons per unit" description="In learning order." to="/content-manager/units" linkLabel="Units">
          {unitRows.length ? <LessonsChart rows={unitRows} /> : <p className="text-sm text-muted-foreground">No unit yet.</p>}
        </Panel>
        <Panel title="Listening exercises per level" description="The practice library." to="/content-manager/listening" linkLabel="Library">
          {summary.exercises.total ? <ExercisesChart rows={exercisesByLevel(data.exercises)} /> : <p className="text-sm text-muted-foreground">No listening exercise yet.</p>}
        </Panel>
      </div>

      <Panel title="Listening course by level" description="Published topics and the level test of each level." to="/content-manager/listening-course" linkLabel="Course">
        <CourseLevels rows={courseCoverage(data.course)} />
      </Panel>

      <OrphanMediaPanel />

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Go to</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <tool.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="flex-1">{tool.title}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

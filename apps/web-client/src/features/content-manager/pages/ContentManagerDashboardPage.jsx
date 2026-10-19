import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Circle, ClipboardCheck, Compass, FileText, GraduationCap, Headphones, Library, PenLine, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, Skeleton } from '../../../components/ui';
import { FeatureCard } from '../../../components/shared/FeatureCard.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { greeting } from '../../student/lib/home.js';
import { getPlacementTest, listListeningCourse, listListeningExercises, listMockTests, listUnits } from '../api/content-api.js';
import { lessonState } from '../lib/lesson-draft.js';
import { contentSummary, courseCoverage, exercisesByLevel, lessonsByUnit, pendingDrafts, readinessChecks } from '../lib/dashboard.js';

// Chart colours (D78): published in --chart-1, not yet published in muted.
const chartConfig = {
  published: { label: 'Published', color: 'hsl(var(--chart-1))' },
  unpublished: { label: 'Not published', color: 'hsl(var(--muted-foreground) / 0.35)' },
};

function Tile({ icon: Icon, label, published, total, extra, to, tone = 'bg-primary/10 text-primary' }) {
  return (
    <Link to={to} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block text-2xl font-bold tabular-nums">
          {published}
          <span className="text-base font-medium text-muted-foreground"> / {total}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{extra || 'published / written'}</span>
      </span>
    </Link>
  );
}

function Panel({ title, description, action, children }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Lessons per unit, stacked: published and not yet. Units without a lesson show as empty.
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
          <Bar dataKey="published" stackId="lessons" fill="var(--color-published)" radius={[0, 0, 0, 0]} isAnimationActive={false} barSize={16} />
          <Bar dataKey="unpublished" stackId="lessons" fill="var(--color-unpublished)" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={16}>
            <LabelList dataKey="total" position="right" offset={6} fontSize={11} className="fill-muted-foreground" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// Listening exercises per level, stacked the same way.
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

const testTone = { published: 'text-success', draft: 'text-warning', missing: 'text-muted-foreground' };
const testLabel = { published: 'Level test live', draft: 'Level test in draft', missing: 'No level test' };

function CourseLevels({ rows }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {rows.map((row) => (
        <li key={row.level} className={cn('rounded-xl border p-3', row.publishedUnits === 0 && 'border-dashed')}>
          <p className="flex items-center justify-between">
            <span className="font-semibold">{row.level}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {row.publishedUnits}/{row.units} units
            </span>
          </p>
          <p className={cn('mt-1 text-xs', testTone[row.levelTest])}>{testLabel[row.levelTest]}</p>
        </li>
      ))}
    </ol>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-[96px] rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

// The Content Manager's overview (D116): how much of each area is published,
// what blocks learners, the drafts waiting, and the tools.
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

  const header = <PageHeader eyebrow="Content Manager" title={`${greeting()}.`} description="What learners can open today, what is still being written, and where to continue." />;

  if (state === 'loading')
    return (
      <section className="space-y-8">
        {header}
        <DashboardSkeleton />
      </section>
    );
  if (state === 'error')
    return (
      <section className="space-y-8">
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
  const unitRows = lessonsByUnit(data.units);

  return (
    <section className="space-y-8">
      {header}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Library} label="Lessons" published={summary.lessons.published} total={summary.lessons.total} extra={`${summary.units.published} of ${summary.units.total} units published`} to="/content-manager/units" />
        <Tile icon={FileText} label="Mock tests" published={summary.mockTests.published} total={summary.mockTests.total} to="/content-manager/mock-tests" tone="bg-info/10 text-info" />
        <Tile icon={Headphones} label="Listening exercises" published={summary.exercises.published} total={summary.exercises.total} to="/content-manager/listening" tone="bg-warning/10 text-warning" />
        <Tile icon={GraduationCap} label="Listening course units" published={summary.courseUnits.published} total={summary.courseUnits.total} extra={`${summary.levelTests.published} of ${summary.levelTests.total} level tests published`} to="/content-manager/listening-course" tone="bg-success/10 text-success" />
      </div>

      {data.partial ? <p className="text-sm text-muted-foreground">Some areas could not be loaded; their numbers show as 0 until you reload.</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel
          title="What learners are missing"
          description={open.length ? `${open.length} of ${checks.length} checks still open` : 'Everything a learner needs is published.'}
        >
          <ul className="space-y-2">
            {checks.map((check) => (
              <li key={check.key}>
                <Link to={check.to} className="flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
                  {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="Open" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', check.ok ? 'text-muted-foreground' : 'font-medium')}>{check.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{check.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Drafts waiting" description={drafts.length ? `${drafts.length} item${drafts.length === 1 ? '' : 's'} with unpublished changes` : 'No draft is waiting.'}>
          {drafts.length ? (
            <ul className="divide-y">
              {drafts.slice(0, 8).map((draft) => (
                <li key={`${draft.kind}-${draft.id}`}>
                  <Link to={draft.to} className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-accent/60">
                    <PenLine className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
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
            <p className="text-sm text-muted-foreground">Every change you made is published.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Lessons per unit"
          description="Published and not yet published lessons of each unit, in learning order."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/content-manager/units">
                Units
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          {unitRows.length ? <LessonsChart rows={unitRows} /> : <p className="text-sm text-muted-foreground">No unit yet. Create the first one to start the course.</p>}
        </Panel>
        <Panel
          title="Listening exercises per level"
          description="Dictation and song exercises of the practice library."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/content-manager/listening">
                Library
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          {summary.exercises.total ? <ExercisesChart rows={exercisesByLevel(data.exercises)} /> : <p className="text-sm text-muted-foreground">No listening exercise yet.</p>}
        </Panel>
      </div>

      <Panel
        title="Listening course by level"
        description="Published units out of all written, and the level test that opens the next level."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/content-manager/listening-course">
              Course
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <CourseLevels rows={courseCoverage(data.course)} />
      </Panel>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Library} title="Units and lessons" description="Create, order, edit and publish content" to="/content-manager/units" />
          <FeatureCard icon={ClipboardCheck} title="Placement test" description="Write and publish the test new learners take" to="/content-manager/placement" tone="success" />
          <FeatureCard icon={FileText} title="Mock tests" description="Write and publish full TOEIC-style tests" to="/content-manager/mock-tests" tone="info" />
          <FeatureCard icon={GraduationCap} title="Listening course" description="Units, lessons and level tests from A1 to C1" to="/content-manager/listening-course" tone="success" />
          <FeatureCard icon={Compass} title="Listening placement" description="The test that finds the level a learner starts the course at" to="/content-manager/listening-placement" />
          <FeatureCard icon={Headphones} title="Listening exercises" description="Dictation and song exercises for the practice library" to="/content-manager/listening" tone="warning" />
          <FeatureCard icon={Tags} title="Listening topics" description="Topics the exercises are grouped by" to="/content-manager/listening-topics" tone="info" />
          <FeatureCard icon={BookOpen} title="Lesson editor tips" description="Paste a whole passage, a vocabulary list or questions to fill a lesson quickly" to="/content-manager/units" />
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { MockFormat } from '@appenglish/content-contracts';
import { BarChart3, Check, PenLine, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { paginate } from '../../../lib/list.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, ChartContainer, ChartTooltip, ChartTooltipContent } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { getMockStats, getMockTest } from '../api/content-api.js';
import { MockFormatBadge, formatOf } from '../components/MockFormatBadge.jsx';
import { StatSort, filterStatQuestions, flagInfo, flaggedQuestions, statSortOptions } from '../lib/mock-stats.js';

const PAGE_SIZE = 20;
const chartConfig = { rate: { label: 'Correct', color: 'hsl(var(--chart-1))' } };
const rateTone = (rate) => (rate === null ? 'bg-muted' : rate < 30 ? 'bg-destructive' : rate < 60 ? 'bg-warning' : 'bg-success');

function Stat({ label, value, note }) {
  return (
    <div className="space-y-1 rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {note ? <p className="text-xs text-muted-foreground tabular-nums">{note}</p> : null}
    </div>
  );
}

function RateBar({ rate }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className={cn('block h-full rounded-full', rateTone(rate))} style={{ width: `${rate ?? 0}%` }} />
      </span>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{rate === null ? '—' : `${rate}%`}</span>
    </div>
  );
}

function Choices({ question }) {
  const answered = question.answered || 1;
  return (
    <div className="flex flex-wrap gap-1.5">
      {question.options.map((option) => (
        <span
          key={option.id}
          title={option.text || `Option ${option.letter}`}
          className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs tabular-nums', option.isCorrect ? 'border-success bg-success/10 font-semibold text-success' : 'text-muted-foreground')}
        >
          {option.isCorrect ? <Check className="h-3 w-3" /> : null}
          {option.letter} {Math.round((option.chosen * 100) / answered)}%
        </span>
      ))}
      {question.skipped ? <span className="rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">skipped {question.skipped}</span> : null}
    </div>
  );
}

function QuestionRow({ question }) {
  const flag = flagInfo[question.flag];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums">{question.number}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Part {question.partKey.replace('part', '')}</span>
          {question.prompt ? <span className="truncate font-medium">{question.prompt}</span> : null}
          {flag ? <Badge variant={flag.variant}>{flag.label}</Badge> : null}
        </p>
        <Choices question={question} />
      </div>
      <RateBar rate={question.rate} />
    </li>
  );
}

export function MockStatsPage() {
  const { mockTestId } = useParams();
  const [state, setState] = useState('loading');
  const [stats, setStats] = useState(null);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState(null);
  const { filters, setFilter, page, setPage } = useListState({ search: '', part: 'all', sort: StatSort.NUMBER });
  const editorPath = `/content-manager/mock-tests/${mockTestId}`;

  async function load() {
    setState('loading');
    try {
      const [result, mock] = await Promise.all([getMockStats(mockTestId), getMockTest(mockTestId).catch(() => null)]);
      setStats(result.data);
      setTitle(mock?.data?.mockTest?.title || 'Mock test');
      setFormat(mock?.data?.mockTest ? formatOf(mock.data.mockTest) : null);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the results', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [mockTestId]);

  const breadcrumb = <PageBreadcrumb items={[{ label: 'Mock tests', to: '/content-manager/mock-tests' }, { label: title || 'Mock test', to: editorPath }, { label: 'Results' }]} />;

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-4">
        {breadcrumb}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const practice = format === MockFormat.PRACTICE;
  const flagged = flaggedQuestions(stats.questions);
  const shown = paginate(filterStatQuestions(stats.questions, filters), page, PAGE_SIZE);
  const partOptions = [{ value: 'all', label: 'All parts' }, ...stats.parts.map((part) => ({ value: part.key, label: `Part ${part.number}` }))];
  const chartRows = stats.parts.map((part) => ({ name: `P${part.number}`, rate: part.rate ?? 0, shown: part.rate === null ? '' : `${part.rate}%` }));

  return (
    <section className="space-y-6">
      {breadcrumb}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Results</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            <span className="truncate">{title}</span>
            {format ? <MockFormatBadge format={format} /> : null}
          </h1>
          {stats.versionNumber ? <p className="text-sm text-muted-foreground">Questions as in published version {stats.versionNumber}.</p> : null}
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to={editorPath}>
            <PenLine className="h-4 w-4" />
            Edit the test
          </Link>
        </Button>
      </div>

      <div className={cn('grid gap-3 sm:grid-cols-2', practice ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
        <Stat label="Learners" value={stats.learners} />
        <Stat label={practice ? 'Full sets taken' : 'Full tests taken'} value={stats.fullAttempts} />
        <Stat label="Mini tests taken" value={stats.miniAttempts} />
        {practice ? null : (
          <Stat
            label="Average estimated score"
            value={stats.averageScore ? `${stats.averageScore.total} / 990` : '—'}
            note={stats.averageScore ? `Listening ${stats.averageScore.listening} · Reading ${stats.averageScore.reading}` : null}
          />
        )}
      </div>

      {!stats.published ? (
        <EmptyState icon={BarChart3} title="The test is not published" description="Publish it again to see the results per question." />
      ) : !stats.enoughLearners ? (
        <EmptyState icon={Users} title="Few learners yet" description={`Results per question show once ${stats.minLearners} learners have finished the test.`} />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
              <div>
                <h2 className="font-semibold">Correct answers per part</h2>
                <p className="text-sm text-muted-foreground tabular-nums">{stats.skills.map((skill) => `${skill.skill === 'LISTENING' ? 'Listening' : 'Reading'} ${skill.rate ?? '—'}%`).join(' · ')}</p>
              </div>
              <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full" role="img" aria-label={`Correct answers per part: ${stats.parts.map((part) => `Part ${part.number} ${part.rate ?? 0}%`).join(', ')}`}>
                <BarChart data={chartRows} margin={{ top: 20, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="rate" fill="var(--color-rate)" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={40}>
                    <LabelList dataKey="shown" position="top" offset={4} fontSize={11} className="fill-muted-foreground" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Questions to check</h2>
                <Badge variant={flagged.length ? 'warning' : 'secondary'} className="tabular-nums">
                  {flagged.length}
                </Badge>
              </div>
              {flagged.length ? (
                <ul className="max-h-72 divide-y overflow-y-auto">
                  {flagged.map((question) => (
                    <li key={question.id} className="flex items-center gap-3 py-2">
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums">{question.number}</span>
                      <span className="min-w-0 flex-1">
                        <Badge variant={flagInfo[question.flag].variant}>{flagInfo[question.flag].label}</Badge>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">Part {question.partKey.replace('part', '')}{question.prompt ? ` · ${question.prompt}` : ''}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{question.rate}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No question stands out.</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 lg:flex-row lg:items-center">
              <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search questions" />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <FilterSelect label="Part" value={filters.part} onChange={setFilter('part')} options={partOptions} className="w-full sm:w-36" />
                <FilterSelect label="Sort by" value={filters.sort} onChange={setFilter('sort')} options={statSortOptions} className="w-full sm:w-44" />
              </div>
            </div>
            {shown.total === 0 ? (
              <div className="p-6">
                <EmptyState icon={BarChart3} title="No question matches" description="Try another search or part." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((question) => (
                  <QuestionRow key={question.id} question={question} />
                ))}
              </ul>
            )}
          </div>
          <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="question" onChange={setPage} />
        </>
      )}
    </section>
  );
}

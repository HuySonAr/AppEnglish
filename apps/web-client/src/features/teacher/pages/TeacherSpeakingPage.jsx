import { useEffect, useState } from 'react';
import { ChevronRight, Mic, Plus, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { createPracticePrompt, listPracticePrompts, savePracticePromptDraft } from '../../../lib/api/practice-prompts-api.js';
import { SPEAKING_PARTS, applyEtsTask, etsTaskOf, filterPrompts, levelOptions, levelScores, levelShort, speakingPartOf, statusInfo, teacherPromptPath } from '../../../lib/practice-prompts.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', level: 'all', status: 'all' };
const UNSORTED = 'unsorted';
const statusOptions = [
  { value: 'all', label: 'All states' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Taken down' },
];

export function TeacherSpeakingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);
  const [creating, setCreating] = useState(false);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);
  const speaking = prompts.filter((prompt) => prompt.kind !== PracticePromptKind.WRITING);
  const unsorted = speaking.filter((prompt) => !speakingPartOf(prompt));
  const wanted = params.get('part');
  const current = wanted === UNSORTED && unsorted.length ? UNSORTED : SPEAKING_PARTS.find((part) => String(part.number) === wanted) ? Number(wanted) : 1;
  const part = SPEAKING_PARTS.find((item) => item.number === current) || null;

  async function load() {
    setState('loading');
    try {
      setPrompts((await listPracticePrompts()).data.prompts.map((prompt) => ({ ...prompt, etsTask: etsTaskOf(prompt.kind, prompt) })));
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function choose(value) {
    setParams({ part: String(value) }, { replace: true });
  }

  async function create() {
    if (!part) return;
    setCreating(true);
    try {
      const created = (await createPracticePrompt(part.kind)).data;
      if (part.kind !== PracticePromptKind.READ_ALOUD) await savePracticePromptDraft(created.prompt.id, applyEtsTask(part.kind, created.latest.content, part.etsTask));
      navigate(teacherPromptPath(part.kind, created.prompt.id));
    } catch (error) {
      notify({ title: 'Could not create the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
      setCreating(false);
    }
  }

  const inPart = current === UNSORTED ? unsorted : speaking.filter((prompt) => speakingPartOf(prompt)?.number === current);
  const shown = paginate(filterPrompts(inPart, filters), page, PAGE_SIZE);
  const narrowed = Object.entries(DEFAULTS).some(([key, value]) => filters[key] !== value);
  const newButton = part ? (
    <Button className="gap-2" loading={creating} onClick={create}>
      <Plus className="h-4 w-4" />
      Add prompt to Part {part.number}
    </Button>
  ) : null;

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Teacher" title="Speaking prompts" description="Choose a part, then add or edit its prompts." actions={newButton} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="Parts">
            {SPEAKING_PARTS.map((item) => {
              const count = speaking.filter((prompt) => speakingPartOf(prompt)?.number === item.number).length;
              return (
                <button
                  key={item.number}
                  type="button"
                  role="tab"
                  aria-selected={current === item.number}
                  onClick={() => choose(item.number)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    current === item.number ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent',
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className={cn('text-sm font-semibold', current === item.number && 'text-primary')}>Part {item.number}</span>
                    <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">{count}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{item.title}</span>
                  <span className="text-[11px] text-muted-foreground/80">{item.questions}</span>
                </button>
              );
            })}
          </div>
          {unsorted.length ? (
            <button
              type="button"
              onClick={() => choose(UNSORTED)}
              className={cn('text-sm underline-offset-4 hover:underline', current === UNSORTED ? 'font-medium text-primary' : 'text-muted-foreground')}
            >
              {unsorted.length} prompt{unsorted.length === 1 ? '' : 's'} without a part — open one and choose its task type
            </button>
          ) : null}

          {inPart.length === 0 ? (
            <EmptyState icon={Mic} title={part ? `No prompts in Part ${part.number} yet` : 'Nothing here'} description="Add the first one." action={newButton} />
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="space-y-3 border-b bg-muted/30 p-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title or topic" />
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-40" />
                      <FilterSelect label="State" value={filters.status} onChange={setFilter('status')} options={statusOptions} className="w-full sm:w-36" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      {shown.total} prompt{shown.total === 1 ? '' : 's'}
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
                  <div className="p-6">
                    <EmptyState icon={Mic} title="No prompt matches" description="Try another search or filter." />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {shown.items.map((prompt) => (
                      <li key={prompt.id}>
                        <Link
                          to={teacherPromptPath(prompt.kind, prompt.id)}
                          className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold" title={levelScores(prompt.level)}>
                            {levelShort(prompt.level)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{prompt.title || 'Untitled prompt'}</span>
                            <span className="block truncate text-xs text-muted-foreground">{prompt.topic || 'No topic yet'}</span>
                          </span>
                          <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                            {prompt.publishedVersionNumber && prompt.status !== 'PUBLISHED' ? <Badge variant="success">Live v{prompt.publishedVersionNumber}</Badge> : null}
                            <Badge variant={statusInfo[prompt.status].variant}>{statusInfo[prompt.status].label}</Badge>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Pagination page={shown.page} pageCount={shown.pageCount} total={shown.total} noun="prompt" onChange={setPage} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

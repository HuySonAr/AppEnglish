import { useEffect, useState } from 'react';
import { BookOpenText, ChevronRight, Mic, PenLine, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { createPracticePrompt, listPracticePrompts } from '../../../lib/api/practice-prompts-api.js';
import { filterPrompts, kindLabels, kindOptions, levelOptions, statusInfo } from '../../../lib/practice-prompts.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', kind: 'all', level: 'all', status: 'all' };
const statusOptions = [
  { value: 'all', label: 'All states' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Taken down' },
];
const kindChoices = [
  { kind: PracticePromptKind.READ_ALOUD, icon: Mic, detail: 'A sentence or short passage to read.' },
  { kind: PracticePromptKind.OPEN_SPEAKING, icon: Mic, detail: 'A question or picture to talk about.' },
  { kind: PracticePromptKind.WRITING, icon: PenLine, detail: 'An email, paragraph or short essay.' },
];

export function TeacherPromptsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(null);
  const { filters, setFilters, setFilter, page, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      setPrompts((await listPracticePrompts()).data.prompts);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(kind) {
    setBusy(kind);
    try {
      const result = await createPracticePrompt(kind);
      navigate(`/teacher/prompts/${result.data.prompt.id}`);
    } catch (error) {
      notify({ title: 'Could not create the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
      setBusy(null);
    }
  }

  const shown = paginate(filterPrompts(prompts, filters), page, PAGE_SIZE);
  const narrowed = Object.entries(DEFAULTS).some(([key, value]) => filters[key] !== value);
  const newButton = (
    <Button className="gap-2" onClick={() => setChoosing(true)}>
      <Plus className="h-4 w-4" />
      New prompt
    </Button>
  );

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Teacher" title="Speaking and writing prompts" description="Write prompts by CEFR level and send them for review." actions={newButton} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : prompts.length === 0 ? (
        <EmptyState icon={BookOpenText} title="No prompts yet" description="Write your first prompt." action={newButton} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="space-y-3 border-b bg-muted/30 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title or topic" />
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <FilterSelect label="Kind" value={filters.kind} onChange={setFilter('kind')} options={kindOptions} className="w-full sm:w-40" />
                  <FilterSelect label="Level" value={filters.level} onChange={setFilter('level')} options={levelOptions} className="w-full sm:w-32" />
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
                <EmptyState icon={BookOpenText} title="No prompt matches" description="Try another search or filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((prompt) => (
                  <li key={prompt.id}>
                    <Link
                      to={`/teacher/prompts/${prompt.id}`}
                      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">{prompt.level || '—'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{prompt.title || 'Untitled prompt'}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {kindLabels[prompt.kind]}
                          {prompt.topic ? ` · ${prompt.topic}` : ''}
                        </span>
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

      <Dialog open={choosing} onOpenChange={(open) => !busy && setChoosing(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New prompt</DialogTitle>
            <DialogDescription>Choose what learners will do.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {kindChoices.map((choice) => (
              <button
                key={choice.kind}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => create(choice.kind)}
                className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', busy === choice.kind && 'border-primary')}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <choice.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{kindLabels[choice.kind]}</span>
                  <span className="block text-xs text-muted-foreground">{choice.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

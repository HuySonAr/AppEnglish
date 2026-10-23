import { useEffect, useState } from 'react';
import { AudioLines, ChevronRight, Mic, PenLine, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { paginate } from '../../../lib/list.js';
import { Badge, Button } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { FilterSelect, SearchField } from '../../../components/shared/ListFilter.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Pagination } from '../../../components/shared/Pagination.jsx';
import { useListState } from '../../../hooks/use-list-state.js';
import { createPracticePrompt, listPracticePrompts } from '../../../lib/api/practice-prompts-api.js';
import { filterPrompts, levelOptions, statusInfo, teacherPromptPath } from '../../../lib/practice-prompts.js';

const PAGE_SIZE = 10;
const DEFAULTS = { search: '', level: 'all', status: 'all' };
const statusOptions = [
  { value: 'all', label: 'All states' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Taken down' },
];

export const kindPages = {
  [PracticePromptKind.READ_ALOUD]: { title: 'Read-aloud prompts', description: 'Write a sentence or short passage for learners to read.', create: 'New read-aloud prompt', empty: 'No read-aloud prompts yet', icon: AudioLines },
  [PracticePromptKind.OPEN_SPEAKING]: { title: 'Open speaking prompts', description: 'Ask a question or show a picture for learners to talk about.', create: 'New open speaking prompt', empty: 'No open speaking prompts yet', icon: Mic },
  [PracticePromptKind.WRITING]: { title: 'Writing prompts', description: 'Set an email, paragraph or short essay with a sample answer.', create: 'New writing prompt', empty: 'No writing prompts yet', icon: PenLine },
};

export function TeacherPromptsPage({ kind }) {
  const page = kindPages[kind];
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);
  const [creating, setCreating] = useState(false);
  const { filters, setFilters, setFilter, page: pageNumber, setPage } = useListState(DEFAULTS);

  async function load() {
    setState('loading');
    try {
      setPrompts((await listPracticePrompts()).data.prompts.filter((prompt) => prompt.kind === kind));
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [kind]);

  async function create() {
    setCreating(true);
    try {
      const result = await createPracticePrompt(kind);
      navigate(teacherPromptPath(kind, result.data.prompt.id));
    } catch (error) {
      notify({ title: 'Could not create the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
      setCreating(false);
    }
  }

  const shown = paginate(filterPrompts(prompts, filters), pageNumber, PAGE_SIZE);
  const narrowed = Object.entries(DEFAULTS).some(([key, value]) => filters[key] !== value);
  const newButton = (
    <Button className="gap-2" loading={creating} onClick={create}>
      <Plus className="h-4 w-4" />
      {page.create}
    </Button>
  );

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Teacher" title={page.title} description={page.description} actions={newButton} />

      {state === 'loading' ? (
        <RowsSkeleton rows={5} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : prompts.length === 0 ? (
        <EmptyState icon={page.icon} title={page.empty} description="Write your first one." action={newButton} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="space-y-3 border-b bg-muted/30 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <SearchField value={filters.search} onChange={setFilter('search')} placeholder="Search by title or topic" />
                <div className="grid grid-cols-2 gap-2 sm:flex">
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
                <EmptyState icon={page.icon} title="No prompt matches" description="Try another search or filter." />
              </div>
            ) : (
              <ul className="divide-y">
                {shown.items.map((prompt) => (
                  <li key={prompt.id}>
                    <Link
                      to={teacherPromptPath(kind, prompt.id)}
                      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">{prompt.level || '—'}</span>
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
    </section>
  );
}

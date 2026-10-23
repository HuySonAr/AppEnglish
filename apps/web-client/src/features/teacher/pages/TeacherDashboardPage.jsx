import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { greeting } from '../../student/lib/home.js';
import { listPracticePrompts } from '../../../lib/api/practice-prompts-api.js';
import { kindLabels, statusCounts, statusInfo } from '../../../lib/practice-prompts.js';

const tiles = [
  { key: 'RETURNED', label: 'Returned to you' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PENDING_REVIEW', label: 'In review' },
  { key: 'PUBLISHED', label: 'Published' },
];

export function TeacherDashboardPage() {
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);

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

  const header = <PageHeader eyebrow="Teacher" title={`${greeting()}.`} description="Your prompts and what needs your attention." />;
  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <section className="space-y-6">
        {header}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const counts = statusCounts(prompts);
  const attention = prompts.filter((prompt) => prompt.status === 'RETURNED' || prompt.status === 'DRAFT').slice(0, 6);

  return (
    <section className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.key} to={`/teacher/prompts?status=${tile.key}`} className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="text-2xl font-bold tabular-nums">{counts[tile.key]}</p>
          </Link>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">To finish</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/teacher/prompts">
              All prompts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {attention.length ? (
          <ul className="divide-y">
            {attention.map((prompt) => (
              <li key={prompt.id}>
                <Link to={`/teacher/prompts/${prompt.id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
                  <BookOpenText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{prompt.title || 'Untitled prompt'}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {kindLabels[prompt.kind]} · {prompt.level}
                    </span>
                  </span>
                  <Badge variant={statusInfo[prompt.status].variant}>{statusInfo[prompt.status].label}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing to finish.</p>
        )}
      </div>
    </section>
  );
}

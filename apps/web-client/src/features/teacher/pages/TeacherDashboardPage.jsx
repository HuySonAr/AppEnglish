import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { greeting } from '../../student/lib/home.js';
import { listPracticePrompts } from '../../../lib/api/practice-prompts-api.js';
import { listReviewQueue } from '../api/review-api.js';
import { etsTaskLabel, etsTaskOf, kindLabels, levelLabel, statusCounts, statusInfo, teacherListPath, teacherPromptPath } from '../../../lib/practice-prompts.js';
import { kindPages } from './TeacherPromptsPage.jsx';
import { listContentReviews } from '../../content-manager/api/content-api.js';
import { ReviewStatusBadge } from '../../content-manager/components/ContentReview.jsx';
import { TEACHER_BASE, contentInProgress, contentItemPath, reviewKindLabels, reviewTitle } from '../../content-manager/lib/content-area.js';

const states = [
  { key: 'RETURNED', label: 'Returned' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PENDING_REVIEW', label: 'In review' },
  { key: 'PUBLISHED', label: 'Published' },
];
const urgency = { RETURNED: 0, DRAFT: 1 };

export function TeacherDashboardPage() {
  const [state, setState] = useState('loading');
  const [prompts, setPrompts] = useState([]);
  const [queue, setQueue] = useState(null);
  const [content, setContent] = useState(null);

  async function load() {
    setState('loading');
    try {
      const [promptData, queueData, contentData] = await Promise.all([listPracticePrompts(), listReviewQueue(), listContentReviews().catch(() => null)]);
      setPrompts(promptData.data.prompts);
      setQueue(queueData.data);
      setContent(contentData ? contentData.data.items : null);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your prompts', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const header = <PageHeader eyebrow="Teacher" title={`${greeting()}.`} description="Your content, prompts and what needs your attention." />;
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

  const attention = prompts
    .filter((prompt) => prompt.status in urgency)
    .sort((a, b) => urgency[a.status] - urgency[b.status] || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 6);
  const inProgress = content ? contentInProgress(content, 5) : [];

  return (
    <section className="space-y-6">
      {header}
      <Link to="/teacher/reviews" className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted-foreground">Answers waiting to be graded</span>
          <span className="block text-2xl font-bold tabular-nums">{queue?.reviews.length ?? 0}</span>
        </span>
        <span className="text-sm text-muted-foreground">{queue?.doneThisWeek ?? 0} graded by you this week</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {content ? (
        <div className="space-y-3 rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Content in progress</h2>
            <Link to={`${TEACHER_BASE}/units`} className="text-sm text-primary underline-offset-4 hover:underline">
              Units and lessons
            </Link>
          </div>
          {inProgress.length ? (
            <ul className="divide-y">
              {inProgress.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link to={contentItemPath(TEACHER_BASE, item.kind, item.id)} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{reviewTitle(item)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {reviewKindLabels[item.kind]}
                        {item.context ? ` · ${item.context}` : ''} · v{item.versionNumber}
                      </span>
                    </span>
                    <ReviewStatusBadge status={item.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No content in progress.</p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(kindPages).map(([kind, page]) => {
          const counts = statusCounts(prompts.filter((prompt) => prompt.kind === kind));
          return (
            <div key={kind} className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
              <Link to={teacherListPath(kind)} className="group flex items-center gap-2 font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <page.icon className="h-4 w-4" />
                </span>
                <span className="flex-1">{kindLabels[kind]}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <div className="grid grid-cols-4 gap-2">
                {states.map((item) => (
                  <Link key={item.key} to={`${teacherListPath(kind)}?status=${item.key}`} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center transition-colors hover:bg-accent">
                    <span className={cn('block text-lg font-bold tabular-nums', item.key === 'RETURNED' && counts.RETURNED ? 'text-warning' : '')}>{counts[item.key]}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="font-semibold">To finish</h2>
        {attention.length ? (
          <ul className="divide-y">
            {attention.map((prompt) => {
              const Icon = kindPages[prompt.kind].icon;
              return (
                <li key={prompt.id}>
                  <Link to={teacherPromptPath(prompt.kind, prompt.id)} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{prompt.title || 'Untitled prompt'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {etsTaskLabel(etsTaskOf(prompt.kind, prompt), kindLabels[prompt.kind])} · {levelLabel(prompt.level)}
                      </span>
                    </span>
                    <Badge variant={statusInfo[prompt.status].variant}>{statusInfo[prompt.status].label}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing to finish.</p>
        )}
      </div>
    </section>
  );
}

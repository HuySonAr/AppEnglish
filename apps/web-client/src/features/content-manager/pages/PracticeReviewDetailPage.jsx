import { useEffect, useState } from 'react';
import { Check, EyeOff, Undo2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PRACTICE_LIMITS, PracticePromptStatus } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PracticePromptView } from '../../../components/shared/PracticePromptView.jsx';
import { approvePracticePrompt, deletePracticePrompt, getPracticePrompt, returnPracticePrompt, unpublishPracticePrompt } from '../../../lib/api/practice-prompts-api.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { changedFields, etsTaskLabel, etsTaskOf, kindLabels, reviewAreaOf, reviewListPath, reviewPromptPath, statusInfo } from '../../../lib/practice-prompts.js';
import { Avatar } from '../../../components/shared/Avatar.jsx';

export function PracticeReviewDetailPage() {
  const { promptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  async function load() {
    setState('loading');
    try {
      const result = (await getPracticePrompt(promptId)).data;
      const wanted = reviewPromptPath(result.prompt.kind, promptId);
      if (location.pathname !== wanted) return navigate(wanted, { replace: true });
      setData(result);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [promptId]);

  async function run(label, action, success) {
    setBusy(label);
    try {
      setData((await action()).data);
      notify({ title: success });
      return true;
    } catch (error) {
      notify({ title: 'Could not do that', description: getApiErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={location.pathname.includes('/writing-prompts') ? reviewListPath('writing') : reviewListPath('speaking')}>
          Back to prompts
        </Link>
      </div>
    );

  const { prompt, latest, published, media } = data;
  const pending = latest.status === PracticePromptStatus.PENDING_REVIEW;
  const compare = pending && published && published.id !== latest.id;
  const changes = compare ? changedFields(published.content, latest.content) : [];

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: reviewAreaOf(prompt.kind) === 'writing' ? 'Writing prompts' : 'Speaking prompts', to: reviewListPath(reviewAreaOf(prompt.kind)) }, { label: latest.content.title || 'Untitled prompt' }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-5 sm:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{latest.content.title || 'Untitled prompt'}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {kindLabels[prompt.kind]} · {etsTaskLabel(etsTaskOf(prompt.kind, latest.content), 'No task type')} · version {latest.versionNumber}
            </span>
            <span className="flex items-center gap-1.5">
              · by
              <Avatar account={prompt.author} size="sm" className="h-5 w-5 text-[10px]" />
              <span className="font-medium text-foreground">{prompt.author?.displayName || 'Unknown teacher'}</span>
            </span>
            <Badge variant={statusInfo[latest.status].variant}>{statusInfo[latest.status].label}</Badge>
            {published && published.id !== latest.id ? <Badge variant="success">Live v{published.versionNumber}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {published ? (
            <Button variant="ghost" className="gap-1.5 text-muted-foreground hover:text-destructive" disabled={Boolean(busy)} onClick={() => setConfirmUnpublish(true)}>
              <EyeOff className="h-4 w-4" />
              Take down
            </Button>
          ) : null}
          {!published && prompt.everPublished ? (
            <ContentDangerActions
              noun="prompt"
              busy={Boolean(busy)}
              onDelete={async () => {
                await deletePracticePrompt(promptId);
                navigate(reviewListPath(reviewAreaOf(prompt.kind)), { replace: true });
              }}
            />
          ) : null}
          {pending ? (
            <>
              <Button variant="outline" className="gap-1.5" disabled={Boolean(busy)} onClick={() => setReturning(true)}>
                <Undo2 className="h-4 w-4" />
                Return
              </Button>
              <Button className="gap-1.5" loading={busy === 'approve'} disabled={Boolean(busy)} onClick={() => run('approve', () => approvePracticePrompt(promptId), 'Prompt published')}>
                <Check className="h-4 w-4" />
                Approve and publish
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {latest.status === PracticePromptStatus.RETURNED && latest.reviewNote ? (
        <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="font-medium">Your note to the teacher</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{latest.reviewNote}</p>
        </div>
      ) : null}

      {compare ? (
        <Tabs defaultValue="new" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="new">New version</TabsTrigger>
              <TabsTrigger value="live">Live version</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              {changes.length ? (
                <>
                  Changed:
                  {changes.map((change) => (
                    <Badge key={change} variant="outline">
                      {change}
                    </Badge>
                  ))}
                </>
              ) : (
                'No visible change.'
              )}
            </div>
          </div>
          <TabsContent value="new" className="rounded-xl border bg-card p-5 shadow-sm">
            <PracticePromptView kind={prompt.kind} content={latest.content} media={media} />
          </TabsContent>
          <TabsContent value="live" className="rounded-xl border bg-card p-5 shadow-sm">
            <PracticePromptView kind={prompt.kind} content={published.content} media={media} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <PracticePromptView kind={prompt.kind} content={latest.content} media={media} />
        </div>
      )}

      <Dialog open={returning} onOpenChange={(open) => !busy && setReturning(open)}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await run('return', () => returnPracticePrompt(promptId, note.trim()), 'Returned to the teacher')) {
                setReturning(false);
                setNote('');
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Return to the teacher</DialogTitle>
              <DialogDescription>Say what to change.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="return-note">Note</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {note.length}/{PRACTICE_LIMITS.reviewNote}
                </span>
              </div>
              <Textarea id="return-note" rows={5} maxLength={PRACTICE_LIMITS.reviewNote} value={note} onChange={(event) => setNote(event.target.value)} disabled={Boolean(busy)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => setReturning(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy === 'return'} disabled={!note.trim()}>
                Return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmUnpublish} onOpenChange={(open) => !busy && setConfirmUnpublish(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take this prompt down?</AlertDialogTitle>
            <AlertDialogDescription>Learners stop seeing it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(busy)}
              onClick={async (event) => {
                event.preventDefault();
                if (await run('unpublish', () => unpublishPracticePrompt(promptId), 'Prompt taken down')) setConfirmUnpublish(false);
              }}
            >
              {busy === 'unpublish' ? 'Taking down…' : 'Take down'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

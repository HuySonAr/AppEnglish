import { useState } from 'react';
import { Clock, GitCompare, MessageSquareWarning, Send, Undo2 } from 'lucide-react';
import { CONTENT_REVIEW_NOTE_MAX, LessonVersionStatus } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';
import { approveContentReview, returnContentReview, withdrawContentReview } from '../api/content-api.js';
import { reviewReasonMessage, reviewStatusInfo } from '../lib/content-area.js';
import { outlineChanges } from '../lib/version-outline.js';

export const reviewErrorMessage = (error) => reviewReasonMessage(error?.response?.data?.data?.reason) || getApiErrorMessage(error);

export function ReviewStatusBadge({ status, version }) {
  const info = reviewStatusInfo[status];
  return info ? (
    <Badge variant={info.variant}>
      {info.label}
      {version ? ` v${version}` : ''}
    </Badge>
  ) : null;
}

export function SubmitForReviewButton({ loading, disabled, onClick }) {
  return (
    <Button className="gap-2" loading={loading} disabled={disabled} onClick={onClick}>
      <Send className="h-4 w-4" />
      Submit for review
    </Button>
  );
}

export function ReviewBanner({ kind, id, status, note, canAuthor, disabled = false, onChanged }) {
  const [pending, setPending] = useState(false);

  async function withdraw() {
    setPending(true);
    try {
      await withdrawContentReview(kind, id);
      notify({ title: 'Withdrawn from review', description: 'You can edit it again.' });
      await onChanged?.();
    } catch (error) {
      notify({ title: 'Could not withdraw it', description: reviewErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  if (status === LessonVersionStatus.PENDING_REVIEW && canAuthor)
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-info/40 bg-info/10 p-4 text-sm">
        <Clock className="h-5 w-5 shrink-0 text-info" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Waiting for review</p>
          <p className="text-muted-foreground">Withdraw it to make changes.</p>
        </div>
        <Button variant="outline" className="gap-1.5" loading={pending} disabled={disabled || pending} onClick={withdraw}>
          <Undo2 className="h-4 w-4" />
          Withdraw
        </Button>
      </div>
    );
  if (status === LessonVersionStatus.RETURNED && note)
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
        <MessageSquareWarning className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Returned with a note</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{note}</p>
        </div>
      </div>
    );
  return null;
}

export function ManagerReviewActions({ kind, id, disabled = false, onChanged }) {
  const approve = usePublishAction();
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  async function onApprove() {
    try {
      await approveContentReview(kind, id);
      notify({ title: 'Approved and published' });
      onChanged?.();
      return true;
    } catch (error) {
      const issues = error?.response?.data?.data?.issues;
      notify({ title: 'Could not approve it', description: issues?.[0]?.message || reviewErrorMessage(error), variant: 'destructive' });
      return false;
    }
  }

  async function onReturn(event) {
    event.preventDefault();
    setPending(true);
    try {
      await returnContentReview(kind, id, note.trim());
      notify({ title: 'Returned to the teachers' });
      setReturning(false);
      setNote('');
      await onChanged?.();
    } catch (error) {
      notify({ title: 'Could not return it', description: reviewErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  const busy = disabled || pending || approve.state !== 'idle';
  return (
    <>
      <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => setReturning(true)}>
        <Undo2 className="h-4 w-4" />
        Return
      </Button>
      <PublishButton label="Approve" state={approve.state} disabled={disabled || pending} onClick={() => approve.run(onApprove)} />

      <Dialog open={returning} onOpenChange={(open) => !pending && setReturning(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onReturn}>
            <DialogHeader>
              <DialogTitle>Return for changes</DialogTitle>
              <DialogDescription>Say what to change.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="content-return-note">Note</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {note.length}/{CONTENT_REVIEW_NOTE_MAX}
                </span>
              </div>
              <Textarea id="content-return-note" rows={5} maxLength={CONTENT_REVIEW_NOTE_MAX} value={note} disabled={pending} onChange={(event) => setNote(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setReturning(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={pending || !note.trim()}>
                Return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ChangesFromPublished({ kind, draft, published }) {
  if (!draft) return null;
  const changes = published ? outlineChanges(kind, draft, published) : [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="h-4 w-4" aria-hidden="true" />
          Changes from published
        </CardTitle>
        {published ? null : <CardDescription>Nothing is published yet.</CardDescription>}
      </CardHeader>
      {published ? (
        <CardContent>
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No change.</p>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border text-sm">
              {changes.map((change) => (
                <li key={change.title} className="space-y-1.5 px-3 py-2.5">
                  <p className="font-medium">
                    {change.title}
                    {change.before ? <span className="font-normal text-muted-foreground"> · was {change.before}</span> : null}
                  </p>
                  {change.added.length || change.removed.length ? (
                    <ul className="space-y-0.5">
                      {change.added.map((line, index) => (
                        <li key={`a${index}`} className="rounded-md bg-success/10 px-2 py-0.5 text-success">
                          + {line}
                        </li>
                      ))}
                      {change.removed.map((line, index) => (
                        <li key={`r${index}`} className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive line-through">
                          - {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {change.other ? <p className="text-muted-foreground">{change.other}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

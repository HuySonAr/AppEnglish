import { useEffect, useState } from 'react';
import { History, RotateCcw, Trash2 } from 'lucide-react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '../../../components/ui';
import { ContentResponseCode, WORKING_VERSION_STATUSES } from '@appenglish/content-contracts';
import { reviewStatusInfo } from '../lib/content-area.js';
import { errorCode } from '../../../lib/api/response.js';
import { deleteContentVersion, getContentVersion, listContentVersions, restoreContentVersion } from '../api/content-api.js';
import { versionOutline } from '../lib/version-outline.js';
import { DiscardDraftButton } from './DiscardDraftButton.jsx';

function deleteVersionMessage(error) {
  const data = error?.response?.data?.data || {};
  if (errorCode(error) === ContentResponseCode.CONTENT_IN_USE)
    return `Learners have ${data.results || 'some'} attempt${data.results === 1 ? '' : 's'} on this version; it is kept so they can look at their answers.`;
  if (data.reason === 'CURRENT') return 'This is the version learners get. Unpublish it or publish another one first.';
  return getApiErrorMessage(error);
}

const isWorking = (version) => WORKING_VERSION_STATUSES.includes(version.status);

function statusOf(version) {
  if (isWorking(version)) return reviewStatusInfo[version.status];
  if (version.current) return { label: 'Published · live', variant: 'success' };
  return { label: 'Published · taken down', variant: 'outline' };
}

export function VersionHistory({ kind, id, refreshKey, onRestored, noun = 'content', canRestore = true, canDiscard = true, canDeleteVersion = true }) {
  const [state, setState] = useState('loading');
  const [versions, setVersions] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const result = (await deleteContentVersion(kind, id, deleting.id)).data;
      notify({
        title: `Version ${deleting.versionNumber} deleted`,
        description: result.removedMedia ? `${result.removedMedia} file${result.removedMedia === 1 ? '' : 's'} only it used ${result.removedMedia === 1 ? 'was' : 'were'} removed from storage.` : 'No file was only its own.',
      });
      setDeleting(null);
      if (viewing?.meta.id === result.deleted.versionId) setViewing(null);
      await load();
    } catch (error) {
      notify({ title: `Could not delete version ${deleting.versionNumber}`, description: deleteVersionMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setState('loading');
    try {
      setVersions((await listContentVersions(kind, id)).data.versions);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the version history', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }
  useEffect(() => {
    load();
  }, [kind, id, refreshKey]);

  async function view(version) {
    setBusy(true);
    try {
      setViewing({ meta: version, content: (await getContentVersion(kind, id, version.id)).data.version.content });
    } catch (error) {
      notify({ title: 'Could not open the version', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      await restoreContentVersion(kind, id, restoring.id);
      notify({ title: `Version ${restoring.versionNumber} restored as the draft`, description: 'Edit it if you like, then submit it for review.' });
      setRestoring(null);
      setViewing(null);
      await onRestored?.();
      await load();
    } catch (error) {
      notify({ title: 'Could not restore the version', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const format = (iso) => (iso ? new Date(iso).toLocaleString() : '');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" aria-hidden="true" />
          Version history
        </CardTitle>
        <CardDescription>
          {canRestore ? 'Restoring copies a version into the draft.' : 'Open a version to see what it held.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === 'loading' ? (
          <div className="space-y-2">
            {[0, 1].map((item) => <Skeleton key={item} className="h-10 rounded-lg" />)}
          </div>
        ) : state === 'error' ? (
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No version yet: save the draft to create the first one.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border text-sm">
            {versions.map((version) => {
              const status = statusOf(version);
              return (
                <li key={version.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="w-10 font-semibold tabular-nums">v{version.versionNumber}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {version.publishedAt ? `Published ${format(version.publishedAt)}` : `Created ${format(version.createdAt)}`}
                  </span>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => view(version)}>
                    View
                  </Button>
                  {isWorking(version) ? (
                    canDiscard ? (
                      <DiscardDraftButton
                        size="icon"
                        kind={kind}
                        id={id}
                        noun={noun}
                        disabled={busy}
                        onDiscarded={async () => {
                          await onRestored?.();
                          await load();
                        }}
                      />
                    ) : null
                  ) : (
                    <>
                      {canRestore ? (
                        <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => setRestoring(version)}>
                          <RotateCcw className="h-4 w-4" />
                          Restore as draft
                        </Button>
                      ) : null}
                      {version.current || !canDeleteVersion ? null : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete version ${version.versionNumber}`}
                          title="Delete this version"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={busy}
                          onClick={() => setDeleting(version)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle>Version {viewing.meta.versionNumber} · {statusOf(viewing.meta).label}</DialogTitle>
                <DialogDescription>
                  {viewing.meta.publishedAt ? `Published ${format(viewing.meta.publishedAt)}.` : `Created ${format(viewing.meta.createdAt)}.`} Read only.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {versionOutline(kind, viewing.content).map((section) => (
                  <div key={section.title}>
                    <p className="font-medium">{section.title}</p>
                    {section.lines.length ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                        {section.lines.map((line, index) => (
                          <li key={index}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
              {isWorking(viewing.meta) || !canRestore ? null : (
                <div className="flex justify-end">
                  <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => setRestoring(viewing.meta)}>
                    <RotateCcw className="h-4 w-4" />
                    Restore as draft
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete version {deleting?.versionNumber} for good?</AlertDialogTitle>
            <AlertDialogDescription>
              The version and the audio or images that only it uses are removed from storage. This is refused while any learner attempt was taken on this version, so their answers stay reviewable. The draft and the live version are not touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              {busy ? 'Deleting…' : 'Delete version'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(restoring)} onOpenChange={(open) => !open && !busy && setRestoring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {restoring?.versionNumber} as the draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The current draft of this {noun} is replaced by a copy of version {restoring?.versionNumber}. Nothing learners see changes until it is approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                restore();
              }}
            >
              {busy ? 'Restoring…' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

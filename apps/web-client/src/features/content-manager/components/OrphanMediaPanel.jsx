import { useEffect, useState } from 'react';
import { HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { formatBytes } from '../../../lib/files.js';
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
  Checkbox,
  Skeleton,
} from '../../../components/ui';
import { deleteOrphanMedia, listOrphanMedia } from '../api/content-api.js';

export function OrphanMediaPanel() {
  const [state, setState] = useState('loading');
  const [data, setData] = useState({ media: [], totalBytes: 0 });
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function load() {
    setState('loading');
    try {
      setData((await listOrphanMedia()).data);
      setSelected(new Set());
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not check the storage', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }
  useEffect(() => {
    load();
  }, []);

  const all = data.media.length > 0 && selected.size === data.media.length;
  const toggleAll = () => setSelected(all ? new Set() : new Set(data.media.map((asset) => asset.id)));
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function remove() {
    setPending(true);
    try {
      const result = (await deleteOrphanMedia([...selected])).data;
      notify({
        title: `${result.deleted.length} file${result.deleted.length === 1 ? '' : 's'} deleted`,
        description: result.skipped.length ? `${result.skipped.length} skipped: used again or already gone.` : undefined,
      });
      setConfirming(false);
      await load();
    } catch (error) {
      notify({ title: 'Could not delete the files', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" aria-hidden="true" />
            Storage clean-up
          </CardTitle>
          <CardDescription>Uploaded files that no lesson, test, recording or course version uses any more. Files uploaded in the last hour are not listed.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" aria-label="Check again" onClick={load} disabled={state === 'loading'}>
          <RefreshCw className={cn('h-4 w-4', state === 'loading' && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent>
        {state === 'loading' ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-9 rounded-lg" />)}
          </div>
        ) : state === 'error' ? (
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        ) : data.media.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to clean: every stored file is in use.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={all} onCheckedChange={toggleAll} aria-label="Select every file" />
                {data.media.length} unused file{data.media.length === 1 ? '' : 's'} · {formatBytes(data.totalBytes)}
              </label>
              <Button variant="destructive" size="sm" disabled={selected.size === 0} onClick={() => setConfirming(true)}>
                <Trash2 className="h-4 w-4" />
                Delete {selected.size || ''} selected
              </Button>
            </div>
            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
              {data.media.map((asset) => (
                <li key={asset.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Checkbox checked={selected.has(asset.id)} onCheckedChange={() => toggle(asset.id)} aria-label={`Select ${asset.fileName}`} />
                  <span className="min-w-0 flex-1 truncate">{asset.fileName}</span>
                  <Badge variant="secondary">{asset.kind}</Badge>
                  <span className="w-16 text-right tabular-nums text-muted-foreground">{formatBytes(asset.sizeBytes)}</span>
                  <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={(open) => !open && !pending && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} unused file{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>They are removed from storage for good. A file that became used again in the meantime is skipped.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              {pending ? 'Deleting…' : 'Delete files'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

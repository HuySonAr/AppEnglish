import { useState } from 'react';
import { EyeOff, Trash2 } from 'lucide-react';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
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
  Button,
} from '../../../components/ui';

export function deleteRefusalMessage(error) {
  if (errorCode(error) !== ContentResponseCode.CONTENT_IN_USE) return getApiErrorMessage(error);
  const data = error?.response?.data?.data || {};
  if (data.reason === 'COURSE_REFERENCE') return 'A listening course unit, level test or placement still uses this recording. Remove it there first.';
  const results = data.results ? `${data.results} learner result${data.results === 1 ? '' : 's'}` : 'learner results';
  return `Learners already have ${results} for this. It cannot be deleted; unpublish it instead so nobody new can open it.`;
}

export function ContentDangerActions({ noun, published, busy = false, onUnpublish, onDelete, deleteNote, deletable = true }) {
  const [confirm, setConfirm] = useState(null);
  const [pending, setPending] = useState(false);
  const capitalized = `${noun[0].toUpperCase()}${noun.slice(1)}`;

  async function run() {
    setPending(true);
    try {
      if (confirm === 'unpublish') {
        await onUnpublish();
        notify({ title: `${capitalized} unpublished`, description: 'Learners no longer see it; publish again to bring it back.' });
      } else {
        await onDelete();
        notify({ title: `${capitalized} deleted` });
      }
      setConfirm(null);
    } catch (error) {
      notify({ title: confirm === 'delete' ? `Could not delete the ${noun}` : `Could not unpublish the ${noun}`, description: deleteRefusalMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {published && onUnpublish ? (
        <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => setConfirm('unpublish')}>
          <EyeOff className="h-4 w-4" />
          Unpublish
        </Button>
      ) : null}
      {deletable && onDelete ? (
        <Button
          variant="outline"
          size="icon"
          aria-label={`Delete ${noun}`}
          title={`Delete ${noun}`}
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
          onClick={() => setConfirm('delete')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'delete' ? `Delete this ${noun}?` : `Unpublish this ${noun}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? `The ${noun}, its versions and the files only it used are removed for good. This is only possible while no learner has results for it; otherwise unpublish it instead. ${deleteNote || ''}`
                : `Learners stop seeing the ${noun} right away; results they already have are kept. Nothing is lost here: your versions stay, and publishing again makes it live.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                run();
              }}
              className={confirm === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
            >
              {pending ? 'Working…' : confirm === 'delete' ? `Delete ${noun}` : 'Unpublish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import { FileX2 } from 'lucide-react';
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
  Button,
} from '../../../components/ui';
import { discardContentDraft } from '../api/content-api.js';

// Throws the draft of a lesson, mock test, exercise, course item or unit
// review away (D127), with the files only the draft used; the editor then
// shows the published version, or nothing. kind is a ContentVersionKind;
// onDiscarded reloads the editor. size "icon" is the variant for a list row.
export function DiscardDraftButton({ kind, id, noun, disabled = false, onDiscarded, size }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function discard() {
    setPending(true);
    try {
      const result = (await discardContentDraft(kind, id)).data;
      notify({
        title: `Draft v${result.discarded.versionNumber} discarded`,
        description: result.removedMedia ? `${result.removedMedia} file${result.removedMedia === 1 ? '' : 's'} only the draft used ${result.removedMedia === 1 ? 'was' : 'were'} removed from storage.` : undefined,
      });
      setOpen(false);
      await onDiscarded?.();
    } catch (error) {
      notify({ title: 'Could not discard the draft', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {size === 'icon' ? (
        <Button variant="ghost" size="icon" aria-label="Discard draft" title="Discard draft" disabled={disabled} onClick={() => setOpen(true)}>
          <FileX2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" className="gap-1.5" disabled={disabled} onClick={() => setOpen(true)}>
          <FileX2 className="h-4 w-4" />
          Discard draft
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard the draft of this {noun}?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft and the audio or images that only it uses are deleted for good, from storage too. Published and taken-down versions and their files stay; the editor goes back to the published version, or to an empty {noun}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                discard();
              }}
            >
              {pending ? 'Discarding…' : 'Discard draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

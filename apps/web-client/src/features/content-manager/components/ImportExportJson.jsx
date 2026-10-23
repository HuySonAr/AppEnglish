import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';
import { FileRow } from '../../../components/shared/FileRow.jsx';

const MAX_JSON_BYTES = 5 * 1024 * 1024;

export function ImportExportJson({ noun, plan, onImport, exportData, fileName, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);

  async function choose(chosen) {
    try {
      setFile({ name: chosen.name, size: chosen.size, plan: plan(await chosen.text()) });
    } catch (error) {
      notify({ title: 'Could not read the file', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  function apply() {
    onImport(file.plan.content);
    notify({ title: `${file.name} imported`, description: `The ${noun} now holds the file's content. Save the draft or publish to keep it.` });
    setFile(null);
    setOpen(false);
  }

  function download() {
    const blob = new Blob([`${JSON.stringify(exportData(), null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Import JSON
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={download}>
        <Download className="h-4 w-4" />
        Export JSON
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFile(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import a {noun} from JSON</DialogTitle>
            <DialogDescription>
              The file uses the authoring format of content-samples/600-words (see AUTHORING.md); Export JSON gives you one to start from. Importing replaces the text of this {noun}; pronunciation audio of words that stay, and the recordings and images of the test, are kept. Nothing reaches learners until you publish.
            </DialogDescription>
          </DialogHeader>
          {file ? null : (
            <FileDropzone id={`import-${noun}`} accept=".json,application/json" kindLabel="JSON" maxBytes={MAX_JSON_BYTES} title="Drag the JSON file here" onFile={choose} />
          )}
          {file ? (
            <FileRow
              name={file.name}
              sizeBytes={file.size}
              status={file.plan.errors.length ? 'failed' : 'done'}
              error={file.plan.errors.length ? `${file.plan.errors.length} problem${file.plan.errors.length === 1 ? '' : 's'} to fix` : undefined}
              note={file.plan.summary.join(' · ') || 'Checked'}
              onRemove={() => setFile(null)}
            >
              {file.plan.errors.length ? (
                <ul className="list-disc space-y-0.5 pl-5 text-destructive">
                  {file.plan.errors.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {file.plan.warnings.length ? (
                <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-amber-600 dark:text-amber-400">
                  {file.plan.warnings.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {file.plan.errors.length ? null : <p className="text-muted-foreground">Ready to import{file.plan.warnings.length ? '; the warnings can be fixed in the editor afterwards' : ''}.</p>}
            </FileRow>
          ) : (
            <p className="text-sm text-muted-foreground">What the file holds is checked and listed here before anything changes.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!file || file.plan.errors.length > 0} onClick={apply}>
              Replace the {noun} with the file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

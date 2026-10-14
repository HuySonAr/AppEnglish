import { useState } from 'react';
import { Download } from 'lucide-react';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '../../../components/ui';
import { ExportFormat, exportBaseName, exportFile, formatOfFileName } from '../lib/timed-import.js';

const formats = {
  [ExportFormat.SRT]: {
    label: 'SubRip subtitles (.srt)',
    note: 'Start and end of every line. Opens in subtitle editors and video players. A song is written without its [blanks].',
    accept: { 'application/x-subrip': ['.srt'] },
  },
  [ExportFormat.LRC]: {
    label: 'LRC lyrics (.lrc)',
    note: 'Start of every line, and the end where a pause follows. Keeps the [blanks] of a song.',
    accept: { 'text/plain': ['.lrc'] },
  },
};

// Saves the sentences of a listening exercise with their times (D90, D91).
// Where the browser lets a page ask (Edge, Chrome), the system's "Save as"
// window picks the folder, the name and the type (.srt or .lrc); elsewhere a
// dialog picks the type and the name and the file is downloaded.
export function ExportTimedDialog({ segments, kind, title, disabled }) {
  const preferred = kind.key === 'song' ? ExportFormat.LRC : ExportFormat.SRT;
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState(preferred);
  const [name, setName] = useState('');
  const noun = kind.key === 'song' ? 'line' : 'sentence';

  function done(fileName, file) {
    notify({
      title: `${fileName} saved`,
      description: `${file.count} ${noun}${file.count === 1 ? '' : 's'} written${file.skipped ? `; ${file.skipped} without a start and end left out` : ''}.`,
    });
  }

  async function saveWithPicker() {
    const order = [preferred, ...Object.values(ExportFormat).filter((item) => item !== preferred)];
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: `${exportBaseName(title)}.${preferred}`,
        types: order.map((item) => ({ description: formats[item].label, accept: formats[item].accept })),
      });
    } catch (error) {
      if (error?.name !== 'AbortError') notify({ title: 'Could not open the save window', description: error.message, variant: 'destructive' });
      return;
    }
    const file = exportFile(segments, kind, formatOfFileName(handle.name), { title });
    try {
      const writable = await handle.createWritable();
      await writable.write(file.text);
      await writable.close();
      done(handle.name, file);
    } catch (error) {
      notify({ title: 'Could not save the file', description: error.message, variant: 'destructive' });
    }
  }

  function download() {
    const fileName = `${exportBaseName(name || title)}.${format}`;
    const file = exportFile(segments, kind, format, { title });
    const url = URL.createObjectURL(new Blob([file.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    done(fileName, file);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => {
          if (typeof window.showSaveFilePicker === 'function') saveWithPicker();
          else {
            setFormat(preferred);
            setName(exportBaseName(title));
            setOpen(true);
          }
        }}
      >
        <Download className="h-4 w-4" />
        Export…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export with times</DialogTitle>
            <DialogDescription>
              Choose the type of file. This browser saves it where its downloads go; to pick the folder, use Edge or Chrome.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Type of file</legend>
            {Object.entries(formats).map(([value, item]) => (
              <label
                key={value}
                className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 text-sm', format === value ? 'border-primary bg-primary/5' : 'hover:bg-accent')}
              >
                <input type="radio" name="export-format" className="mt-1 accent-primary" checked={format === value} onChange={() => setFormat(value)} />
                <span>
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-muted-foreground">{item.note}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="export-name">File name</Label>
            <div className="flex items-center gap-2">
              <Input id="export-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
              <span className="text-sm text-muted-foreground">.{format}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-1.5" onClick={download}>
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';

// A button opening a dialog that fills part of a draft from pasted text. The
// text is read as it is typed by planFor(text), which returns { count, lines,
// … }: lines ({ title, note, text, errors, warnings }) are listed to check and
// nothing changes until the confirm button, which hands the plan to onApply.
// A line with errors blocks it. noun names what is counted ("question").
// With fileAccept (e.g. ".srt,.lrc") a text file can be opened instead of
// pasting; its text lands in the box. icon replaces the paste icon.
export function PasteDialog({ id, button, title, description, label, placeholder, notFound, noun, done, planFor, onApply, fileAccept, icon: Icon = ClipboardPaste }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const plan = planFor(text);
  const blocked = plan.lines.some((line) => line.errors.length);
  const counted = `${plan.count} ${noun}${plan.count === 1 ? '' : 's'}`;

  function apply() {
    onApply(plan);
    notify({ title: `${counted} ${done}` });
    setText('');
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Icon className="h-4 w-4" />
        {button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {fileAccept ? (
            <FileDropzone
              id={`${id}-file`}
              compact
              accept={fileAccept}
              kindLabel={fileAccept.split(',').map((part) => part.trim().replace(/^\./, '').toUpperCase()).join(', ')}
              maxBytes={2 * 1024 * 1024}
              title="Drag a file here, or paste its text below"
              onFile={async (file) => {
                try {
                  setText(await file.text());
                } catch (error) {
                  notify({ title: 'Could not read the file', description: getApiErrorMessage(error), variant: 'destructive' });
                }
              }}
            />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea id={id} className="font-mono text-sm" rows={9} placeholder={placeholder} value={text} onChange={(event) => setText(event.target.value)} />
          </div>
          {plan.lines.length ? (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">
              {plan.lines.map((line, index) => (
                <li key={index}>
                  <p>
                    <span className="font-medium">{line.title}</span>
                    {line.errors.length ? null : <span className="text-muted-foreground">{line.note}</span>}
                  </p>
                  <p className="truncate text-muted-foreground">{line.text}</p>
                  {line.errors.length ? <p className="text-destructive">{line.errors.join(' · ')}</p> : null}
                  {line.warnings.length ? <p className="text-amber-600 dark:text-amber-400">{line.warnings.join(' · ')}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {text.trim() ? notFound : 'What is found will be listed here before anything is changed.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!plan.count || blocked} onClick={apply}>
              {plan.count ? `Fill in ${counted}` : `Fill in ${noun}s`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

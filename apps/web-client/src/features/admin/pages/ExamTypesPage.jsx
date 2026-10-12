import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { createExamType, listExamTypes, renameExamType } from '../../../lib/api/exam-types-api.js';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { ContentResponseCode } from '@appenglish/content-contracts';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';

const failure = (error) =>
  errorCode(error) === ContentResponseCode.EXAM_TYPE_INVALID
    ? 'An exam type with this name already exists.'
    : getApiErrorMessage(error);

// The kinds of exam the content is written for. TOEIC is built in; others can
// be listed here ahead of time, but tests can only be written for a type once
// the app has an editor for it.
export function ExamTypesPage() {
  const [state, setState] = useState('loading');
  const [examTypes, setExamTypes] = useState([]);
  const [name, setName] = useState('');
  // { id, name } of the type being renamed.
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setExamTypes((await listExamTypes()).data.examTypes);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the exam types', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Runs one change, then reloads the list. Returns whether it worked.
  async function run(action, success, title) {
    setBusy(true);
    try {
      await action();
      notify({ title: success });
      await load({ quiet: true });
      return true;
    } catch (error) {
      notify({ title, description: failure(error), variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(event) {
    event.preventDefault();
    if (await run(() => createExamType(name.trim()), 'Exam type added', 'Could not add the exam type')) setName('');
  }

  async function onRename() {
    if (await run(() => renameExamType(editing.id, editing.name.trim()), 'Exam type renamed', 'Could not rename the exam type'))
      setEditing(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Exam types"
        description="The kinds of exam the content is written for. Mock tests are grouped and filtered by exam type."
      />

      <form onSubmit={onAdd} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="exam-type-name">New exam type</Label>
          <Input id="exam-type-name" placeholder="e.g. IELTS" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </div>
        <Button type="submit" disabled={busy || !name.trim()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add exam type
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        A new exam type has no editor yet: it can be listed here, but tests can be written only for
        types marked “Editor available”. Today that is TOEIC.
      </p>

      {state === 'loading' ? (
        <RowsSkeleton rows={3} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {examTypes.map((examType) => (
            <li key={examType.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-medium">{examType.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{examType.code}</span>
              <Badge variant={examType.hasEditor ? 'success' : 'outline'}>
                {examType.hasEditor ? 'Editor available' : 'No editor yet'}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Rename ${examType.name}`}
                onClick={() => setEditing({ id: examType.id, name: examType.name })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename exam type</DialogTitle>
            <DialogDescription>The new name shows everywhere the exam type is listed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="exam-type-rename">Name</Label>
            <Input
              id="exam-type-rename"
              value={editing?.name || ''}
              maxLength={100}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={onRename} disabled={busy || !editing?.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

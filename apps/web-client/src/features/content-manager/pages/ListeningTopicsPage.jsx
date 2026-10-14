import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { createListeningTopic, listListeningTopics, updateListeningTopic } from '../../../lib/api/listening-topics-api.js';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';

// How a topic's exercises are written (D88); 'none' stands for no format yet.
const formats = [
  { value: 'toeic', label: 'TOEIC parts' },
  { value: 'song', label: 'Songs' },
  { value: 'none', label: 'Not yet' },
];
const formatLabel = (format) => formats.find((item) => item.value === (format || 'none')).label;

const failure = (error) => {
  if (errorCode(error) !== ContentResponseCode.LISTENING_TOPIC_INVALID) return getApiErrorMessage(error);
  return error?.response?.data?.data?.reason === 'HAS_EXERCISES'
    ? 'The exercise type of a topic with exercises cannot change.'
    : 'A topic with this name already exists.';
};

function FormatSelect({ id, value, onChange }) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {formats.map((format) => (
          <SelectItem key={format.value} value={format.value}>
            {format.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Topics of the listening practice (D85), kept by an Admin or a Content
// Manager (eyebrow names the role). Each topic has an exercise type, TOEIC
// parts or songs (D88); a topic without one cannot have exercises yet, and the
// type is fixed once the topic has exercises.
export function ListeningTopicsPage({ eyebrow }) {
  const [state, setState] = useState('loading');
  const [topics, setTopics] = useState([]);
  const [name, setName] = useState('');
  const [format, setFormat] = useState('song');
  // { id, name, format } of the topic being edited.
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setState('loading');
    try {
      setTopics((await listListeningTopics()).data.topics);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the topics', description: getApiErrorMessage(error), variant: 'destructive' });
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
    const added = await run(() => createListeningTopic(name.trim(), format === 'none' ? null : format), 'Topic added', 'Could not add the topic');
    if (added) setName('');
  }

  async function onSaveEdit() {
    const changes = { name: editing.name.trim(), format: editing.format === 'none' ? null : editing.format };
    if (await run(() => updateListeningTopic(editing.id, changes), 'Topic saved', 'Could not save the topic')) setEditing(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Listening topics"
        description="The topics learners choose from in the listening practice. Exercises are grouped and filtered by topic."
      />

      <form onSubmit={onAdd} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="topic-name">New topic</Label>
          <Input id="topic-name" placeholder="e.g. Songs" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2 sm:w-44">
          <Label htmlFor="topic-format">Exercise type</Label>
          <FormatSelect id="topic-format" value={format} onChange={setFormat} />
        </div>
        <Button type="submit" loading={busy} disabled={busy || !name.trim()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add topic
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        The exercise type decides how the topic's exercises are written: the four TOEIC parts, or
        songs (lyrics line by line, with words in [brackets] to fill in). A topic of type “Not yet” is
        only listed. The type cannot change once the topic has exercises.
      </p>

      {state === 'loading' ? (
        <RowsSkeleton rows={3} />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {topics.map((topic) => (
            <li key={topic.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{topic.code}</span>
              <Badge variant={topic.hasEditor ? 'success' : 'outline'}>{formatLabel(topic.format)}</Badge>
              <Button variant="ghost" size="icon" aria-label={`Edit ${topic.name}`} onClick={() => setEditing({ id: topic.id, name: topic.name, format: topic.format || 'none' })}>
                <Pencil className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit topic</DialogTitle>
            <DialogDescription>The new name shows everywhere the topic is listed. The exercise type can change only while the topic has no exercises.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topic-rename">Name</Label>
              <Input id="topic-rename" value={editing?.name || ''} maxLength={100} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-edit-format">Exercise type</Label>
              <FormatSelect id="topic-edit-format" value={editing?.format || 'none'} onChange={(value) => setEditing({ ...editing, format: value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={onSaveEdit} disabled={busy || !editing?.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

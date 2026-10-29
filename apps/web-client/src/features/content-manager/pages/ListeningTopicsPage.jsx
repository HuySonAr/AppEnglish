import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ContentResponseCode, LISTENING_TEST_SCORES, PRACTICE_LEVELS, PRACTICE_LEVEL_INFO } from '@appenglish/content-contracts';
import { createListeningTopic, deleteListeningTopic, listListeningTopics, updateListeningTopic } from '../../../lib/api/listening-topics-api.js';
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

const formats = [
  { value: 'toeic', label: 'TOEIC parts' },
  { value: 'song', label: 'Songs' },
  { value: 'talks', label: 'Talks and news' },
  { value: 'none', label: 'Not yet' },
];
const formatLabel = (format) => formats.find((item) => item.value === (format || 'none')).label;
const levels = [{ value: 'none', label: 'No level' }, ...PRACTICE_LEVELS.map((level) => ({ value: level, label: `${PRACTICE_LEVEL_INFO[level].label} · ${LISTENING_TEST_SCORES[level].replace('TOEIC Listening ', '')}` }))];
const levelValue = (value) => (value === 'none' ? null : value);

const failure = (error) => {
  if (errorCode(error) !== ContentResponseCode.LISTENING_TOPIC_INVALID) return getApiErrorMessage(error);
  return error?.response?.data?.data?.reason === 'HAS_EXERCISES'
    ? 'The exercise type of a topic with exercises cannot change.'
    : 'A topic with this name already exists.';
};

const deleteFailure = (error) => {
  const data = error?.response?.data?.data;
  if (errorCode(error) !== ContentResponseCode.LISTENING_TOPIC_INVALID || data?.reason !== 'HAS_EXERCISES') return getApiErrorMessage(error);
  const count = data.exerciseCount;
  return `It still has ${count ? `${count} exercise${count === 1 ? '' : 's'}` : 'exercises'}. Delete or move them first.`;
};

function OptionSelect({ id, value, onChange, options }) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const FormatSelect = (props) => <OptionSelect {...props} options={formats} />;
const LevelSelect = (props) => <OptionSelect {...props} options={levels} />;

export function ListeningTopicsPage({ eyebrow }) {
  const [state, setState] = useState('loading');
  const [topics, setTopics] = useState([]);
  const [name, setName] = useState('');
  const [format, setFormat] = useState('toeic');
  const [level, setLevel] = useState('none');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
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
    const added = await run(() => createListeningTopic(name.trim(), format === 'none' ? null : format, format === 'toeic' ? levelValue(level) : null), 'Topic added', 'Could not add the topic');
    if (added) setName('');
  }

  async function onSaveEdit() {
    const changes = { name: editing.name.trim(), format: editing.format === 'none' ? null : editing.format, level: editing.format === 'toeic' ? levelValue(editing.level) : null };
    if (await run(() => updateListeningTopic(editing.id, changes), 'Topic saved', 'Could not save the topic')) setEditing(null);
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteListeningTopic(removing.id);
      notify({ title: 'Topic deleted' });
      setRemoving(null);
      await load({ quiet: true });
    } catch (error) {
      notify({ title: 'Could not delete the topic', description: deleteFailure(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Listening topics"
        description="The topics learners choose from in the listening practice. Exercises are grouped and filtered by topic."
      />

      <form onSubmit={onAdd} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="topic-name">New topic</Label>
          <Input id="topic-name" placeholder="e.g. Songs" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2 sm:w-44">
          <Label htmlFor="topic-format">Exercise type</Label>
          <FormatSelect id="topic-format" value={format} onChange={setFormat} />
        </div>
        {format === 'toeic' ? (
          <div className="space-y-2 sm:w-52">
            <Label htmlFor="topic-level">Level</Label>
            <LevelSelect id="topic-level" value={level} onChange={setLevel} />
          </div>
        ) : null}
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
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {topics.map((topic) => (
            <li key={topic.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{topic.code}</span>
              {topic.level ? <Badge variant="secondary">{PRACTICE_LEVEL_INFO[topic.level]?.label}</Badge> : null}
              <Badge variant={topic.hasEditor ? 'success' : 'outline-solid'}>{formatLabel(topic.format)}</Badge>
              <Button variant="ghost" size="icon" aria-label={`Edit ${topic.name}`} onClick={() => setEditing({ id: topic.id, name: topic.name, format: topic.format || 'none', level: topic.level || 'none' })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${topic.name}`} title="Delete" onClick={() => setRemoving({ id: topic.id, name: topic.name })}>
                <Trash2 className="h-4 w-4 text-destructive" />
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
            {editing?.format === 'toeic' ? (
              <div className="space-y-2">
                <Label htmlFor="topic-edit-level">Level</Label>
                <LevelSelect id="topic-edit-level" value={editing.level || 'none'} onChange={(value) => setEditing({ ...editing, level: value })} />
              </div>
            ) : null}
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

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && !busy && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{removing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Only a topic without exercises can be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                onDelete();
              }}
            >
              {busy ? 'Deleting…' : 'Delete topic'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

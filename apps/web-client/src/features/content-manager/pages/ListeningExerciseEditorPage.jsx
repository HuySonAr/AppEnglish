import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContentResponseCode, LISTENING_LEVELS, MediaSection, lyricBlankCount } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { deleteListeningExercise, unpublishListeningExercise } from '../api/content-api.js';
import { notify } from '../../../lib/notify.js';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import {
  getListeningAutoTime,
  getListeningExercise,
  publishListeningExercise,
  requestListeningAutoTime,
  requestListeningTranscribe,
  saveListeningExerciseDraft,
  updateListeningExercise,
} from '../api/content-api.js';
import { RecordingEditor } from '../components/RecordingEditor.jsx';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { lessonState, setIn } from '../lib/lesson-draft.js';
import { listeningIssueLabel, listeningKindOf, workingListening } from '../lib/listening-draft.js';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';

const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

const kindHelp = {
  part1: 'The four statements (A)–(D) about the photograph. Times are optional.',
  part2: 'The question and its three responses. Times are optional.',
  part3: 'The conversation sentence by sentence, each with its start and end.',
  part4: 'The talk sentence by sentence, each with its start and end.',
  song: 'The lyrics line by line, each with its start and end. Mark blanks with [brackets], as in “I [walked] home”.',
};

// Editor of one listening exercise (F05B-2, D85): its details, the recording,
// and the sentences learners write down with their place in the recording.
export function ListeningExerciseEditorPage() {
  const { exerciseId } = useParams();
  const [state, setState] = useState('loading');
  const [exercise, setExercise] = useState(null);
  const [details, setDetails] = useState({ title: '', level: 'B1' });
  const navigate = useNavigate();
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const publish = usePublishAction();
  const [issues, setIssues] = useState([]);

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.LISTENING });
  const setSegments = (change) => update((current) => ({ ...current, segments: change(current.segments) }));

  function apply(data) {
    setExercise(data.exercise);
    setDetails({ title: data.exercise.title, level: data.exercise.level });
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingListening(data, data.exercise.kind));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getListeningExercise(exerciseId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [exerciseId]);

  // Leaving with unsaved edits asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Saving first uploads the recording chosen since the last save.
  async function saveDraft({ quiet = false } = {}) {
    const result = await draftMedia.uploadAll(content);
    if (result.uploadedAny) setContent(result.content);
    if (result.error) throw result.error;
    const data = (await saveListeningExerciseDraft(exerciseId, result.content)).data;
    apply(data);
    draftMedia.reset();
    if (!quiet) notify({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({ title: 'Could not save the draft', description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ quiet: true });
      const data = (await publishListeningExercise(exerciseId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}` });
      return true;
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        notify({
          title: 'The exercise cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({ title: 'Could not publish the exercise', description: saveErrorMessage(error), variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    setBusy(true);
    try {
      setExercise((await updateListeningExercise(exerciseId, { title: details.title.trim(), level: details.level })).data.exercise);
      notify({ title: 'Details saved' });
    } catch (error) {
      notify({ title: 'Could not save the details', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <EditorPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/content-manager/listening">
          Back to listening exercises
        </Link>
      </div>
    );

  const kind = listeningKindOf(exercise.kind);
  const detailsChanged = details.title.trim() !== exercise.title || details.level !== exercise.level;
  const { segments } = content;
  const song = kind.key === 'song';
  const blankCount = song ? segments.reduce((sum, segment) => sum + lyricBlankCount(segment.text), 0) : 0;

  return (
    <section className="space-y-6">
      <Link to="/content-manager/listening" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Listening exercises
      </Link>

      <form onSubmit={onSaveDetails} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_7rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="listening-title">Title</Label>
          <Input id="listening-title" value={details.title} maxLength={200} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listening-level">Level</Label>
          <Select value={details.level} onValueChange={(level) => setDetails({ ...details, level })}>
            <SelectTrigger id="listening-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LISTENING_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" disabled={busy || !details.title.trim() || !detailsChanged}>
          Save details
        </Button>
      </form>

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        {exercise.topic ? <Badge variant="info">{exercise.topic.name}</Badge> : null}
        <Badge variant="secondary">{kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title}</Badge>
        {song ? <Badge variant={blankCount ? 'secondary' : 'outline'}>{blankCount} blank{blankCount === 1 ? '' : 's'}</Badge> : null}
        <div className="ml-auto flex gap-2">
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !(dirty || status.hasDraft)} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? (
            <DiscardDraftButton kind="listeningExercise" id={exerciseId} noun="exercise" disabled={busy} onDiscarded={load} />
          ) : null}
          <ContentDangerActions
            noun="recording"
            published={Boolean(status.publishedVersion)}
            busy={busy}
            onUnpublish={async () => setStatus(lessonState((await unpublishListeningExercise(exerciseId)).data))}
            onDelete={async () => {
              await deleteListeningExercise(exerciseId);
              navigate('/content-manager/listening', { replace: true });
            }}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {kindHelp[kind.key]}
      </p>

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{listeningIssueLabel(issue.path, kind)}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <RecordingEditor
        ownerId={exerciseId}
        kind={kind}
        content={content}
        title={exercise.title}
        edit={edit}
        setSegments={setSegments}
        draftMedia={draftMedia}
        jobs={{
          get: async () => (await getListeningAutoTime(exerciseId)).data.job,
          request: async (task) => (await (task === 'transcribe' ? requestListeningTranscribe : requestListeningAutoTime)(exerciseId)).data.job,
        }}
        beforeJob={async () => {
          if (dirty) await saveDraft({ quiet: true });
        }}
      />

      <VersionHistory kind="listeningExercise" id={exerciseId} noun="exercise" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

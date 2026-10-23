import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { ContentResponseCode, LISTENING_LEVELS, MediaSection } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { deleteListeningExercise, unpublishListeningExercise } from '../api/content-api.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Textarea } from '../../../components/ui/textarea.jsx';
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
import { keepSentenceExtras } from '../lib/course-draft.js';
import { listeningIssueLabel, listeningKindOf, translationPastePlan, workingListening } from '../lib/listening-draft.js';
import { PasteDialog } from '../components/PasteDialog.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';

const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

const kindHelp = {
  part1: 'Write the four statements; times are optional.',
  part2: 'Write the question and its three responses; times are optional.',
  song: 'Mark the words to fill in with [brackets].',
};

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
  const setSegments = (change) => update((current) => ({ ...current, segments: keepSentenceExtras(current.segments, change(current.segments), ['translation']) }));

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

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
  const kindName = kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title;

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'Listening exercises', to: '/content-manager/listening' }, exercise.topic ? { label: exercise.topic.name } : null, { label: exercise.title }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{exercise.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{[exercise.topic?.name, kindName, exercise.level].filter(Boolean).join(' · ')}</span>
            {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
            {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !(dirty || status.hasDraft)} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? <DiscardDraftButton kind="listeningExercise" id={exerciseId} noun="exercise" disabled={busy} onDiscarded={load} size="icon" /> : null}
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

      <form onSubmit={onSaveDetails} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="listening-title">Title</Label>
          <Input id="listening-title" value={details.title} maxLength={200} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <div className="flex flex-wrap gap-1">
            {LISTENING_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={details.level === level}
                onClick={() => setDetails({ ...details, level })}
                className={cn(
                  'h-10 min-w-11 rounded-md border px-2.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  details.level === level ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={busy || !details.title.trim() || !detailsChanged}>
          Save details
        </Button>
      </form>

      <RecordingEditor
        ownerId={exerciseId}
        kind={kind}
        content={content}
        title={exercise.title}
        edit={edit}
        setSegments={setSegments}
        draftMedia={draftMedia}
        hint={kindHelp[kind.key]}
        jobs={{
          get: async () => (await getListeningAutoTime(exerciseId)).data.job,
          request: async (task) => (await (task === 'transcribe' ? requestListeningTranscribe : requestListeningAutoTime)(exerciseId)).data.job,
        }}
        beforeJob={async () => {
          if (dirty) await saveDraft({ quiet: true });
        }}
        tools={
          <PasteDialog
            id="paste-translations"
            button="Paste translations"
            triggerClassName="w-full justify-start gap-2"
            title="Paste the translations"
            description="One Vietnamese line per sentence, in order."
            label="Translations"
            placeholder={'Xin chào, Pete.\nChào Anna.'}
            notFound="No line found."
            noun="translation"
            done="written into the sentences"
            planFor={(text) => translationPastePlan(content.segments, text)}
            onApply={(plan) => setSegments(() => plan.segments)}
          />
        }
        aside={
          <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</p>
            <div className="space-y-1.5">
              <Label htmlFor="listening-source-name" className="text-xs">
                Name
              </Label>
              <Input id="listening-source-name" maxLength={100} placeholder="VOA Learning English" value={content.source.name} onChange={(event) => edit(['source', 'name'], event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listening-source-url" className="text-xs">
                Link
              </Label>
              <Input id="listening-source-url" type="url" maxLength={500} placeholder="https://…" value={content.source.url} onChange={(event) => edit(['source', 'url'], event.target.value)} />
            </div>
          </div>
        }
        segmentExtra={(segment, index) => (
          <Textarea
            aria-label={`Translation of sentence ${index + 1}`}
            placeholder="Vietnamese translation (optional)"
            rows={1}
            maxLength={1000}
            className="min-h-9 bg-muted/40 text-sm"
            value={segment.translation || ''}
            onChange={(event) => edit(['segments', index, 'translation'], event.target.value)}
          />
        )}
      />

      <VersionHistory kind="listeningExercise" id={exerciseId} noun="exercise" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

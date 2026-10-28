import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { ContentResponseCode, ContentReviewKind, LISTENING_LEVELS, LessonVersionStatus, MediaSection } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Textarea } from '../../../components/ui/textarea.jsx';
import {
  deleteListeningExercise,
  getListeningAutoTime,
  getListeningExercise,
  requestListeningAutoTime,
  requestListeningTranscribe,
  saveListeningExerciseDraft,
  submitContentReview,
  unpublishListeningExercise,
  updateListeningExercise,
} from '../api/content-api.js';
import { RecordingEditor } from '../components/RecordingEditor.jsx';
import { ReadOnlyProvider } from '../components/ReadOnly.jsx';
import {
  ChangesFromPublished,
  ManagerReviewActions,
  ReviewBanner,
  ReviewStatusBadge,
  SubmitForReviewButton,
  reviewErrorMessage,
} from '../components/ContentReview.jsx';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { useContentArea } from '../hooks/use-content-area.js';
import { listListeningTests } from '../../../lib/api/listening-topics-api.js';
import { lessonState, setIn } from '../lib/lesson-draft.js';
import { keepSentenceExtras, listeningIssueLabel, listeningKindOf, translationPastePlan, workingListening } from '../lib/listening-draft.js';
import { PasteDialog } from '../components/PasteDialog.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';

const KIND = ContentReviewKind.LISTENING_EXERCISE;
const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${reviewErrorMessage(error)}`;

const kindHelp = {
  part1: 'Write the four statements; times are optional.',
  part2: 'Write the question and its three responses; times are optional.',
  song: 'Mark the words to fill in with [brackets].',
};

export function ListeningExerciseEditorPage() {
  const { exerciseId } = useParams();
  const { base, canAuthor, canManage } = useContentArea();
  const listPath = `${base}/listening`;
  const [state, setState] = useState('loading');
  const [exercise, setExercise] = useState(null);
  const [details, setDetails] = useState({ title: '', level: 'B1', testId: null });
  const [tests, setTests] = useState([]);
  const navigate = useNavigate();
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [compare, setCompare] = useState({ draft: null, published: null });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState([]);

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.LISTENING });
  const setSegments = (change) => update((current) => ({ ...current, segments: keepSentenceExtras(current.segments, change(current.segments)) }));

  function apply(data) {
    setExercise(data.exercise);
    setDetails({ title: data.exercise.title, level: data.exercise.level, testId: data.exercise.test?.id || null });
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingListening(data, data.exercise.kind));
    setCompare({ draft: data.draft?.content ?? null, published: data.published?.content ?? null });
    setDirty(false);
  }

  async function refresh() {
    apply((await getListeningExercise(exerciseId)).data);
    setIssues([]);
  }

  async function load() {
    setState('loading');
    try {
      await refresh();
      listListeningTests()
        .then((result) => setTests(result.data.tests))
        .catch(() => setTests([]));
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
    setBusy('save');
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({ title: 'Could not save the draft', description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setBusy('submit');
    try {
      if (dirty) await saveDraft({ quiet: true });
      await submitContentReview(KIND, exerciseId);
      await refresh();
      notify({ title: 'Sent for review' });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        notify({
          title: 'The exercise cannot be sent yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({ title: 'Could not submit the exercise', description: saveErrorMessage(error), variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    setBusy('details');
    try {
      setExercise((await updateListeningExercise(exerciseId, { title: details.title.trim(), level: details.level, ...(details.testId && details.testId !== exercise.test?.id ? { testId: details.testId } : {}) })).data.exercise);
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
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={listPath}>
          Back to listening exercises
        </Link>
      </div>
    );

  const locked = status.draftStatus === LessonVersionStatus.PENDING_REVIEW;
  const readOnly = !canAuthor || locked;
  const kind = listeningKindOf(exercise.kind);
  const detailsChanged = details.title.trim() !== exercise.title || details.level !== exercise.level || (details.testId || null) !== (exercise.test?.id || null);
  const topicTests = tests.filter((test) => test.topicId === exercise.topic?.id);
  const kindName = kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title;
  const removeExercise = async () => {
    await deleteListeningExercise(exerciseId);
    navigate(listPath, { replace: true });
  };

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'Listening tests', to: listPath }, exercise.topic ? { label: exercise.topic.name } : null, exercise.test ? { label: exercise.test.name } : null, { label: exercise.title }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{exercise.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{[exercise.topic?.name, exercise.test?.name, kindName, kind?.number ? null : exercise.level].filter(Boolean).join(' · ')}</span>
            {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
            {status.hasDraft ? <ReviewStatusBadge status={status.draftStatus} version={status.draftVersion} /> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAuthor && !locked ? (
            <>
              <Button loading={busy === 'save'} variant="outline" disabled={Boolean(busy) || !dirty} onClick={onSave}>
                Save draft
              </Button>
              <SubmitForReviewButton loading={busy === 'submit'} disabled={Boolean(busy) || !(dirty || status.hasDraft)} onClick={onSubmit} />
              {status.hasDraft ? <DiscardDraftButton kind="listeningExercise" id={exerciseId} noun="exercise" disabled={Boolean(busy)} onDiscarded={load} size="icon" /> : null}
            </>
          ) : null}
          {canManage && locked ? <ManagerReviewActions kind={KIND} id={exerciseId} disabled={Boolean(busy)} onChanged={refresh} /> : null}
          <ContentDangerActions
            noun="recording"
            published={Boolean(status.publishedVersion)}
            busy={Boolean(busy)}
            onUnpublish={canManage ? async () => { await unpublishListeningExercise(exerciseId); await refresh(); } : undefined}
            onDelete={canManage || (canAuthor && !status.publishedVersion) ? removeExercise : undefined}
          />
        </div>
      </div>

      <ReviewBanner kind={KIND} id={exerciseId} status={status.draftStatus} note={status.reviewNote} canAuthor={canAuthor} disabled={Boolean(busy)} onChanged={refresh} />

      {canManage ? <ChangesFromPublished kind={KIND} draft={compare.draft} published={compare.published} /> : null}

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before submitting ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{listeningIssueLabel(issue.path, kind)}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canAuthor ? (
        <form onSubmit={onSaveDetails} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="listening-title">Title</Label>
            <Input id="listening-title" value={details.title} maxLength={200} readOnly={locked} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
          </div>
          {kind?.number && topicTests.length ? (
            <div className="space-y-2">
              <Label>Test</Label>
              <div className="flex flex-wrap gap-1">
                {topicTests.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    aria-pressed={details.testId === test.id}
                    disabled={locked}
                    onClick={() => setDetails({ ...details, testId: test.id })}
                    className={cn(
                      'h-10 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      details.testId === test.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                    )}
                  >
                    {test.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {kind?.number ? null : (
          <div className="space-y-2">
            <Label>Level</Label>
            <div className="flex flex-wrap gap-1">
              {LISTENING_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={details.level === level}
                  disabled={locked}
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
          )}
          {locked ? null : (
            <Button type="submit" variant="outline" loading={busy === 'details'} disabled={Boolean(busy) || !details.title.trim() || !detailsChanged}>
              Save details
            </Button>
          )}
        </form>
      ) : null}

      <ReadOnlyProvider value={readOnly}>
        <RecordingEditor
          ownerId={exerciseId}
          kind={kind}
          content={content}
          title={exercise.title}
          edit={edit}
          setSegments={setSegments}
          draftMedia={draftMedia}
          hint={readOnly ? null : kindHelp[kind.key]}
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
                <Input id="listening-source-name" maxLength={100} placeholder="VOA Learning English" readOnly={readOnly} value={content.source.name} onChange={(event) => edit(['source', 'name'], event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="listening-source-url" className="text-xs">
                  Link
                </Label>
                <Input id="listening-source-url" type="url" maxLength={500} placeholder="https://…" readOnly={readOnly} value={content.source.url} onChange={(event) => edit(['source', 'url'], event.target.value)} />
              </div>
            </div>
          }
          segmentExtra={(segment, index) => (
            <Textarea
              aria-label={`Translation of sentence ${index + 1}`}
              placeholder="Vietnamese translation (optional)"
              rows={1}
              maxLength={1000}
              readOnly={readOnly}
              className="min-h-9 bg-muted/40 text-sm"
              value={segment.translation || ''}
              onChange={(event) => edit(['segments', index, 'translation'], event.target.value)}
            />
          )}
        />
      </ReadOnlyProvider>

      <VersionHistory
        kind="listeningExercise"
        id={exerciseId}
        noun="exercise"
        refreshKey={`${status.publishedVersion}-${status.draftVersion}-${status.draftStatus}`}
        onRestored={load}
        canRestore={canAuthor && !locked}
        canDiscard={canAuthor && !locked}
        canDeleteVersion={canManage}
      />
    </section>
  );
}

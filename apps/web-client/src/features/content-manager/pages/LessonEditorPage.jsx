import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  Accent,
  ContentResponseCode,
  FILL_IN_BLANK,
  LESSON_TEST_PARTS,
  MediaSection,
} from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { deleteLesson, unpublishLesson } from '../api/content-api.js';
import { notify } from '../../../lib/notify.js';
import {
  autofillPronunciation,
  getLesson,
  publishLesson,
  saveLessonDraft,
  updateLesson,
} from '../api/content-api.js';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import {
  issueLabel,
  issueLocation,
  lessonState,
  newVocabulary,
  setIn,
  withFillInPassage,
  workingContent,
} from '../lib/lesson-draft.js';
import {
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import { PartEditor, questionRange } from '../components/PartEditor.jsx';
import { PasteVocabularyDialog } from '../components/PasteVocabularyDialog.jsx';
import { ImportExportJson } from '../components/ImportExportJson.jsx';
import { exportLesson, jsonFileName, planLessonImport } from '../lib/authoring-import.js';
import { TextField } from '../components/TextField.jsx';
import { VocabularyCard } from '../components/VocabularyCard.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';
import { useFocusReturn, useListLinkState, useReturnTo } from '../../../hooks/use-return-to.js';

const saveErrorMessage = (error) =>
  `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

export function LessonEditorPage() {
  const { lessonId } = useParams();
  const back = useReturnTo('/content-manager/units');
  const [state, setState] = useState('loading');
  const [lesson, setLesson] = useState(null);
  const navigate = useNavigate();
  const [status, setStatus] = useState(lessonState(null));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const publish = usePublishAction();
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState('vocabulary');
  const [partTab, setPartTab] = useState(LESSON_TEST_PARTS[0].key);
  // Id of the vocabulary item whose pronunciation is being looked up.
  const [filling, setFilling] = useState(null);

  function apply(data) {
    setLesson(data.lesson);
    setTitle(data.lesson.title);
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingContent(data));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getLesson(lessonId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the lesson',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  // Leaving with unsaved edits asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Edits apply to the latest content, so an upload that finishes while the
  // user keeps typing does not overwrite what they typed.
  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) =>
    update((current) => setIn(current, path, value));

  // Vocabulary files and test files are stored in separate folders.
  const draftMedia = useDraftMedia({
    edit,
    lessonId,
    sectionFor: (path) =>
      path[0] === 'vocabulary' ? MediaSection.VOCABULARY : MediaSection.TEST,
  });
  const { media } = draftMedia;

  // Fills the phonetic text and the audio slots that are still empty with the
  // speech service (D123); anything it lacks stays for manual entry or upload.
  async function onAutofill(item) {
    const missing = [
      item.audioUkMediaId ? null : Accent.UK,
      item.audioUsMediaId ? null : Accent.US,
    ].filter(Boolean);
    setFilling(item.id);
    try {
      const { found, phonetic, audio } = (
        await autofillPronunciation(item.word.trim(), missing, lessonId)
      ).data;
      const uploaded = Object.values(audio).filter(Boolean);
      draftMedia.rememberFileNames(uploaded);
      update((current) => ({
        ...current,
        vocabulary: current.vocabulary.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                phonetic: entry.phonetic || phonetic,
                audioUkMediaId:
                  entry.audioUkMediaId || audio[Accent.UK]?.id || null,
                audioUsMediaId:
                  entry.audioUsMediaId || audio[Accent.US]?.id || null,
              }
            : entry,
        ),
      }));
      const lacking = [
        item.phonetic || phonetic ? null : 'phonetic',
        ...missing.map((accent) =>
          audio[accent]
            ? null
            : accent === Accent.UK
              ? 'British audio'
              : 'American audio',
        ),
      ].filter(Boolean);
      notify(
        !found
          ? {
              title: `"${item.word.trim()}" could not be pronounced`,
              description: 'Enter the phonetic and upload the audio yourself.',
              variant: 'destructive',
            }
          : lacking.length
            ? {
                title: 'Partly filled',
                variant: 'warning',
                description: `No ${lacking.join(', ')} came back for this word. Add it yourself.`,
              }
            : { title: 'Pronunciation filled' },
      );
    } catch (error) {
      notify({
        title: 'Auto-fill failed',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setFilling(null);
    }
  }

  function showIssue(path) {
    const location = issueLocation(path);
    setTab(location.tab);
    if (location.part) setPartTab(location.part);
  }

  // Saving first uploads the files chosen since the last save.
  async function saveDraft({ quiet = false } = {}) {
    const result = await draftMedia.uploadAll(content);
    if (result.uploadedAny) setContent(result.content);
    if (result.error) throw result.error;
    const data = (await saveLessonDraft(lessonId, result.content)).data;
    apply(data);
    draftMedia.reset();
    if (!quiet)
      notify({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({
        title: 'Could not save the draft',
        description: saveErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ quiet: true });
      const data = (await publishLesson(lessonId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}` });
      return true;
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (
        errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE &&
        found?.length
      ) {
        setIssues(found);
        showIssue(found[0].path);
        notify({
          title: 'Lesson cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({
          title: 'Could not publish the lesson',
          description: saveErrorMessage(error),
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRename() {
    setBusy(true);
    try {
      const data = (await updateLesson(lessonId, { title: title.trim() })).data;
      setLesson(data.lesson);
      setTitle(data.lesson.title);
      notify({ title: 'Lesson renamed' });
    } catch (error) {
      notify({
        title: 'Could not rename the lesson',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
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
        <Link
          className="block text-sm text-primary underline-offset-4 hover:underline"
          to={back.to} state={back.state}
        >
          Back to units
        </Link>
      </div>
    );

  const canPublish = dirty || status.hasDraft;

  return (
    <section className="space-y-6">
      <Link
        to={back.to} state={back.state}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Units and lessons
      </Link>

      <div className="sticky top-16 z-10 -mx-4 space-y-3 border-b bg-background/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {status.publishedVersion ? (
            <Badge variant="success">
              Published v{status.publishedVersion}
            </Badge>
          ) : (
            <Badge variant="outline">Not published</Badge>
          )}
          {status.hasDraft ? (
            <Badge variant="warning">Draft v{status.draftVersion}</Badge>
          ) : null}
          {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        </div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <Input
            aria-label="Lesson title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className="text-lg font-semibold"
          />
          <div className="flex flex-wrap gap-2 justify-end">
            <ImportExportJson
              noun="lesson"
              disabled={busy}
              plan={(text) => planLessonImport(text, content)}
              onImport={(imported) => {
                setContent(imported);
                setDirty(true);
                setIssues([]);
              }}
              exportData={() => exportLesson(content, { number: lesson.position, title: lesson.title })}
              fileName={jsonFileName(lesson.title)}
            />
            <Button
              variant="outline"
              disabled={busy || !title.trim() || title.trim() === lesson.title}
              onClick={onRename}
            >
              Rename
            </Button>
            <Button loading={busy}
              variant="outline"
              disabled={busy || !dirty}
              onClick={onSave}
            >
              {busy ? 'Working…' : 'Save draft'}
            </Button>
            <PublishButton state={publish.state} disabled={busy || !canPublish} onClick={() => publish.run(onPublish)} />
            {status.hasDraft ? (
              <DiscardDraftButton kind="lesson" id={lessonId} noun="lesson" disabled={busy} onDiscarded={load} />
            ) : null}
            <ContentDangerActions
              noun="lesson"
              published={Boolean(status.publishedVersion)}
              busy={busy}
              onUnpublish={async () => setStatus(lessonState((await unpublishLesson(lessonId)).data))}
              onDelete={async () => {
                await deleteLesson(lessonId);
                navigate(back.to, { replace: true, state: back.state });
              }}
              deleteNote="Later lessons of the unit move up one place."
            />
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">
          Learners keep the published version until you publish again.
          Publishing creates a new version; earlier versions are kept unchanged.
          Audio and images you choose are previewed here and uploaded when you
          save.
        </p>
      </div>

      {issues.length ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <p className="font-medium">
            Fix these before publishing ({issues.length}):
          </p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="font-medium underline-offset-4 hover:underline"
                  onClick={() => showIssue(issue.path)}
                >
                  {issueLabel(issue.path)}
                </button>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="vocabulary">
            Vocabulary ({content.vocabulary.length})
          </TabsTrigger>
          <TabsTrigger value="fillIn">
            Fill-in ({content.fillIn.answers.length})
          </TabsTrigger>
          <TabsTrigger value="test">Lesson test</TabsTrigger>
        </TabsList>

        <TabsContent value="vocabulary" className="space-y-4">
          {content.vocabulary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vocabulary yet.</p>
          ) : null}
          {content.vocabulary.map((item, index) => (
            <VocabularyCard
              key={item.id}
              item={item}
              index={index}
              edit={edit}
              update={update}
              media={media}
              filling={filling}
              onAutofill={onAutofill}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() =>
                update((current) => ({
                  ...current,
                  vocabulary: [...current.vocabulary, newVocabulary()],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add word
            </Button>
            <PasteVocabularyDialog
              vocabulary={content.vocabulary}
              onApply={(vocabulary) => update((current) => ({ ...current, vocabulary }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="fillIn" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Write one passage and type {FILL_IN_BLANK} for each blank, then
            type the answer of each blank below. Learners get exactly these
            answers as a shuffled word bank and place them in the blanks.
          </p>
          <TextField
            id="fill-in-passage"
            label="Passage"
            value={content.fillIn.passage}
            maxLength={5000}
            multiline
            rows={8}
            onChange={(value) =>
              update((current) => ({
                ...current,
                fillIn: withFillInPassage(current.fillIn, value),
              }))
            }
          />
          {content.fillIn.answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The passage has no blanks yet.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {content.fillIn.answers.map((answer, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`blank-${index}`}>Blank {index + 1}</Label>
                  <Input
                    id={`blank-${index}`}
                    value={answer}
                    maxLength={100}
                    placeholder="Answer"
                    autoComplete="off"
                    onChange={(event) =>
                      edit(['fillIn', 'answers', index], event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The lesson test always has seven parts and 23 questions: Parts 1–4
            are Listening, Parts 5–7 are Reading. Every question needs its
            correct answer and an explanation; every audio needs a transcript.
          </p>
          <Tabs value={partTab} onValueChange={setPartTab}>
            <TabsList className="h-auto flex-wrap justify-start">
              {LESSON_TEST_PARTS.map((spec) => (
                <TabsTrigger key={spec.key} value={spec.key}>
                  Part {spec.number} ({questionRange(spec, '')})
                </TabsTrigger>
              ))}
            </TabsList>
            {LESSON_TEST_PARTS.map((spec) => (
              <TabsContent key={spec.key} value={spec.key}>
                <PartEditor
                  spec={spec}
                  part={content.test[spec.key]}
                  edit={edit}
                  media={media}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>

      <VersionHistory kind="lesson" id={lessonId} noun="lesson" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

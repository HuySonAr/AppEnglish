import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { Plus } from 'lucide-react';
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
import { Badge, Button, Input, Label } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { PartEditor, partAnswered } from '../components/PartEditor.jsx';
import { SectionNav } from '../components/SectionNav.jsx';
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

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) =>
    update((current) => setIn(current, path, value));

  const draftMedia = useDraftMedia({
    edit,
    lessonId,
    sectionFor: (path) =>
      path[0] === 'vocabulary' ? MediaSection.VOCABULARY : MediaSection.TEST,
  });
  const { media } = draftMedia;

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
  const issueCount = (match) => issues.filter((issue) => match(issueLocation(issue.path))).length;
  const blanks = content.fillIn.answers.length;
  const blanksFilled = content.fillIn.answers.filter((answer) => answer.trim()).length;
  const section = tab === 'test' ? partTab : tab;
  const choose = (key) => {
    if (key === 'vocabulary' || key === 'fillIn') setTab(key);
    else {
      setTab('test');
      setPartTab(key);
    }
  };
  const navItems = [
    {
      label: 'Lesson',
      items: [
        { key: 'vocabulary', title: 'Vocabulary', detail: `${content.vocabulary.length} word${content.vocabulary.length === 1 ? '' : 's'}`, done: content.vocabulary.length > 0, issues: issueCount((at) => at.tab === 'vocabulary') },
        { key: 'fillIn', title: 'Fill-in', detail: `${blanksFilled}/${blanks} blanks`, done: blanks > 0 && blanksFilled === blanks, issues: issueCount((at) => at.tab === 'fillIn') },
      ],
    },
    {
      label: 'Lesson test',
      items: LESSON_TEST_PARTS.map((spec) => {
        const answered = partAnswered(content.test[spec.key]);
        return {
          key: spec.key,
          title: `Part ${spec.number}`,
          detail: `${answered}/${spec.questionCount} answered`,
          done: answered === spec.questionCount,
          issues: issueCount((at) => at.part === spec.key),
          progress: (answered * 100) / spec.questionCount,
        };
      }),
    },
  ];

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'Units and lessons', to: back.to, state: back.state }, { label: lesson?.title || 'Lesson' }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">
            Lesson {lesson.position}: {lesson.title}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
            {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !canPublish} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? <DiscardDraftButton kind="lesson" id={lessonId} noun="lesson" disabled={busy} onDiscarded={load} size="icon" /> : null}
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onRename();
        }}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="lesson-title">Title</Label>
          <Input id="lesson-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !title.trim() || title.trim() === lesson.title}>
          Rename
        </Button>
      </form>

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => showIssue(issue.path)}>
                  {issueLabel(issue.path)}
                </button>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <SectionNav label="Lesson sections" groups={navItems} active={section} onChoose={choose} />

        <div className="min-w-0 space-y-4">
          {tab === 'vocabulary' ? (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">Vocabulary</h2>
                  <p className="text-sm text-muted-foreground">Auto-fill adds the IPA and audio a word is missing.</p>
                </div>
                <PasteVocabularyDialog vocabulary={content.vocabulary} onApply={(vocabulary) => update((current) => ({ ...current, vocabulary }))} />
              </div>
              {content.vocabulary.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No word yet.</p> : null}
              {content.vocabulary.map((item, index) => (
                <VocabularyCard key={item.id} item={item} index={index} edit={edit} update={update} media={media} filling={filling} onAutofill={onAutofill} />
              ))}
              <Button variant="outline" className="w-full gap-1.5 border-dashed" onClick={() => update((current) => ({ ...current, vocabulary: [...current.vocabulary, newVocabulary()] }))}>
                <Plus className="h-4 w-4" />
                Add word
              </Button>
            </>
          ) : null}

          {tab === 'fillIn' ? (
            <>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="text-lg font-semibold">Fill-in</h2>
                <p className="text-sm text-muted-foreground">Type {FILL_IN_BLANK} for each blank, then its answer.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <TextField
                    id="fill-in-passage"
                    label="Passage"
                    value={content.fillIn.passage}
                    maxLength={5000}
                    multiline
                    rows={12}
                    onChange={(value) => update((current) => ({ ...current, fillIn: withFillInPassage(current.fillIn, value) }))}
                  />
                </div>
                <div className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm font-medium">Answers</p>
                  {blanks === 0 ? (
                    <p className="text-sm text-muted-foreground">No blank yet.</p>
                  ) : (
                    content.fillIn.answers.map((answer, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Label htmlFor={`blank-${index}`} className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                          {index + 1}
                        </Label>
                        <Input
                          id={`blank-${index}`}
                          value={answer}
                          maxLength={100}
                          placeholder="Answer"
                          autoComplete="off"
                          className={cn(answer.trim() ? '' : 'border-dashed')}
                          onChange={(event) => edit(['fillIn', 'answers', index], event.target.value)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}

          {tab === 'test' ? <PartEditor key={partTab} spec={LESSON_TEST_PARTS.find((spec) => spec.key === partTab)} part={content.test[partTab]} edit={edit} media={media} /> : null}
        </div>
      </div>

      <VersionHistory kind="lesson" id={lessonId} noun="lesson" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

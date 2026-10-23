import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { COURSE_LIMITS, ContentResponseCode, CourseItemType, MediaKind, MediaSection } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';
import { useReturnTo } from '../../../hooks/use-return-to.js';
import {
  deleteCourseItem,
  getCourseItem,
  publishCourseItem,
  saveCourseItemDraft,
  unpublishCourseItem,
  updateCourseItem,
} from '../api/content-api.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { CourseQuestionEditor } from '../components/CourseQuestionEditor.jsx';
import { CourseTopicEditor } from '../components/CourseTopicEditor.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { MediaField } from '../components/MediaField.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { courseIssueLabel, keepSentenceExtras, newQuestion, newSection, sectionQuestionCount, workingCourse } from '../lib/course-draft.js';
import { lessonState, setIn } from '../lib/lesson-draft.js';

const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

function SectionsEditor({ sections, onChange, draftMedia }) {
  const count = sectionQuestionCount(sections);
  const minimum = COURSE_LIMITS.levelTestQuestions;
  const setSection = (index, change) => onChange(sections.map((section, at) => (at === index ? change(section) : section)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Level test</h2>
          <p className="text-sm text-muted-foreground">Add recordings with their questions; at least {minimum} questions.</p>
        </div>
        <Badge variant={count >= minimum ? 'success' : 'outline'} className="tabular-nums">
          {count}/{minimum} questions
        </Badge>
      </div>
      {sections.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No recording yet.</p> : null}
      {sections.map((section, index) => (
        <div key={section.id} className="overflow-hidden rounded-xl border bg-muted/20">
          <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
            <p className="font-semibold">Recording {index + 1}</p>
            <Badge variant="secondary" className="tabular-nums">
              {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
            </Badge>
            <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => onChange(sections.filter((_, at) => at !== index))}>
              <Trash2 className="h-4 w-4" />
              Remove recording
            </Button>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <MediaField id={`test-audio-${section.id}`} label="Recording" kind={MediaKind.AUDIO} path={['sections', index, 'audioMediaId']} mediaId={section.audioMediaId} media={draftMedia.media} />
              <div className="space-y-2">
                <Label htmlFor={`test-transcript-${section.id}`}>Transcript</Label>
                <Textarea
                  id={`test-transcript-${section.id}`}
                  rows={4}
                  maxLength={COURSE_LIMITS.transcript}
                  placeholder="One sentence per line; “Man: …” names the speaker."
                  value={section.transcript}
                  onChange={(event) => setSection(index, (current) => ({ ...current, transcript: event.target.value }))}
                />
              </div>
            </div>
            {section.questions.map((question, at) => (
              <CourseQuestionEditor
                key={question.id}
                id={question.id}
                number={at + 1}
                label={`Question ${at + 1}`}
                question={question}
                onChange={(next) => setSection(index, (current) => ({ ...current, questions: current.questions.map((item) => (item.id === question.id ? next : item)) }))}
                onRemove={() => setSection(index, (current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) }))}
              />
            ))}
            <Button
              variant="outline"
              className="w-full gap-1.5 border-dashed"
              disabled={section.questions.length >= COURSE_LIMITS.questionsPerSection}
              onClick={() => setSection(index, (current) => ({ ...current, questions: [...current.questions, newQuestion()] }))}
            >
              <Plus className="h-4 w-4" />
              Add question to recording {index + 1}
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full gap-1.5 border-dashed" disabled={sections.length >= COURSE_LIMITS.sections} onClick={() => onChange([...sections, newSection()])}>
        <Plus className="h-4 w-4" />
        Add a recording
      </Button>
    </div>
  );
}

export function CourseItemEditorPage() {
  const { itemId } = useParams();
  const back = useReturnTo('/content-manager/listening-course');
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [item, setItem] = useState(null);
  const [details, setDetails] = useState({ title: '', description: '' });
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const publish = usePublishAction();
  const [issues, setIssues] = useState([]);
  const [wordMedia, setWordMedia] = useState({});

  function update(change) {
    setContent((current) => (typeof change === 'function' ? change(current) : change));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.LISTENING });
  const setSegments = (change) => update((current) => ({ ...current, segments: keepSentenceExtras(current.segments, change(current.segments)) }));

  function apply(data) {
    setItem(data.item);
    setDetails({ title: data.item.title, description: data.item.description });
    setStatus(lessonState(data));
    setContent(workingCourse(data));
    draftMedia.setStored(data.media || {});
    setWordMedia((current) => ({ ...current, ...Object.fromEntries(Object.entries(data.media || {}).map(([id, asset]) => [id, asset.url])) }));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getCourseItem(itemId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the item', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [itemId]);

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
    const data = (await saveCourseItemDraft(itemId, result.content)).data;
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
      const data = (await publishCourseItem(itemId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}` });
      return true;
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        notify({ title: 'Not ready to publish yet', description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`, variant: 'destructive' });
      } else notify({ title: 'Could not publish', description: saveErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    setBusy(true);
    try {
      setItem((await updateCourseItem(itemId, { title: details.title.trim(), description: details.description.trim() })).data.item);
      notify({ title: 'Details saved' });
    } catch (error) {
      notify({ title: 'Could not save the details', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const backLink = (
    <PageBreadcrumb items={[{ label: 'Listening course', to: back.to, state: back.state }, item ? { label: item.level } : null, { label: item?.title || 'Item' }]} />
  );

  if (state === 'loading') return <EditorPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {backLink}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const topic = item.type === CourseItemType.TOPIC;
  const detailsChanged = details.title.trim() !== item.title || details.description.trim() !== item.description;

  return (
    <section className="space-y-5">
      {backLink}

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{item.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {item.level} · {topic ? 'Topic' : 'Level test'}
            </span>
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
          {status.hasDraft ? <DiscardDraftButton kind="courseItem" id={itemId} noun="item" disabled={busy} onDiscarded={load} size="icon" /> : null}
          <ContentDangerActions
            noun={topic ? 'course topic' : 'level test'}
            published={Boolean(status.publishedVersion)}
            busy={busy}
            onUnpublish={async () => setStatus(lessonState((await unpublishCourseItem(itemId)).data))}
            onDelete={async () => {
              await deleteCourseItem(itemId);
              navigate(back.to, { replace: true, state: back.state });
            }}
          />
        </div>
      </div>

      <form onSubmit={onSaveDetails} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[1fr_1.4fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="item-title">{topic ? 'Topic' : 'Title'}</Label>
          <Input id="item-title" maxLength={200} value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-description">Description</Label>
          <Input id="item-description" maxLength={2000} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !details.title.trim() || !detailsChanged}>
          Save details
        </Button>
      </form>

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{courseIssueLabel(issue.path)}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {topic ? (
        <CourseTopicEditor
          itemId={itemId}
          title={item.title}
          content={content}
          onChange={update}
          edit={edit}
          setSegments={setSegments}
          draftMedia={draftMedia}
          issues={issues}
          beforeJob={async () => {
            if (dirty) await saveDraft({ quiet: true });
          }}
          wordMedia={wordMedia}
          onWordMedia={(id, url) => setWordMedia((current) => ({ ...current, [id]: url }))}
        />
      ) : (
        <SectionsEditor sections={content.sections} onChange={(sections) => update((current) => ({ ...current, sections }))} draftMedia={draftMedia} />
      )}

      <VersionHistory kind="courseItem" id={itemId} noun="item" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

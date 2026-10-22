import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COURSE_LIMITS, ContentResponseCode, CourseItemType, MediaKind, MediaSection } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Card, CardContent, Input, Label } from '../../../components/ui';
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

// The recordings of a level test (D147), each uploaded here with its
// transcript (shown to learners after the test) and its questions.
function SectionsEditor({ sections, onChange, draftMedia }) {
  const count = sectionQuestionCount(sections);
  const minimum = COURSE_LIMITS.levelTestQuestions;
  const setSection = (index, change) => onChange(sections.map((section, at) => (at === index ? change(section) : section)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={count >= minimum ? 'success' : 'secondary'}>
          {count} question{count === 1 ? '' : 's'} (at least {minimum})
        </Badge>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" disabled={sections.length >= COURSE_LIMITS.sections} onClick={() => onChange([...sections, newSection()])}>
          <Plus className="h-4 w-4" />
          Add a recording
        </Button>
      </div>
      {sections.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No recording yet. Add the first one.</p> : null}
      {sections.map((section, index) => (
        <Card key={section.id}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <span className="font-medium">Recording {index + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" aria-label={`Remove recording ${index + 1}`} onClick={() => onChange(sections.filter((_, at) => at !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <MediaField
              id={`test-audio-${section.id}`}
              label="Recording (MP3, MP4 or M4A)"
              kind={MediaKind.AUDIO}
              path={['sections', index, 'audioMediaId']}
              mediaId={section.audioMediaId}
              media={draftMedia.media}
            />
            <div className="space-y-1">
              <Label htmlFor={`test-transcript-${section.id}`}>Transcript</Label>
              <Textarea
                id={`test-transcript-${section.id}`}
                rows={4}
                maxLength={COURSE_LIMITS.transcript}
                placeholder={'One sentence per line; "Man: …" at the start of a line names the speaker.'}
                value={section.transcript}
                onChange={(event) => setSection(index, (current) => ({ ...current, transcript: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Learners read it with the answers after the test.</p>
            </div>
            {section.questions.map((question, at) => (
              <CourseQuestionEditor
                key={question.id}
                id={question.id}
                label={`Question ${at + 1}`}
                question={question}
                onChange={(next) => setSection(index, (current) => ({ ...current, questions: current.questions.map((item) => (item.id === question.id ? next : item)) }))}
                onRemove={() => setSection(index, (current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) }))}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={section.questions.length >= COURSE_LIMITS.questionsPerSection}
              onClick={() => setSection(index, (current) => ({ ...current, questions: [...current.questions, newQuestion()] }))}
            >
              <Plus className="h-4 w-4" />
              Add question
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// A topic or a level test of the Listening course (D143–D145).
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
  // The URLs of the words' pronunciations, by media id.
  const [wordMedia, setWordMedia] = useState({});

  // A change is a new content or a function of the current one.
  function update(change) {
    setContent((current) => (typeof change === 'function' ? change(current) : change));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  // Recordings chosen in the browser are uploaded when the draft is saved.
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.LISTENING });
  // A sentence replaced by a paste or an import keeps its translation and
  // blanks when its words stay the same (D147).
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

  // Saving first uploads the recordings chosen since the last save.
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
    <Link to={back.to} state={back.state} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening course
    </Link>
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
    <section className="space-y-6">
      {backLink}
      <form onSubmit={onSaveDetails} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Badge variant="info">{item.level}</Badge>
        <Badge variant="secondary">{topic ? 'Topic' : 'Level test'}</Badge>
        {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        <div className="ml-auto flex gap-2">
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !(dirty || status.hasDraft)} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? <DiscardDraftButton kind="courseItem" id={itemId} noun="item" disabled={busy} onDiscarded={load} /> : null}
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
          beforeJob={async () => {
            if (dirty) await saveDraft({ quiet: true });
          }}
          wordMedia={wordMedia}
          onWordMedia={(id, url) => setWordMedia((current) => ({ ...current, [id]: url }))}
        />
      ) : (
        <>
          <h2 className="text-lg font-semibold">Level test</h2>
          <SectionsEditor sections={content.sections} onChange={(sections) => update((current) => ({ ...current, sections }))} draftMedia={draftMedia} />
        </>
      )}

      <VersionHistory kind="courseItem" id={itemId} noun="item" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

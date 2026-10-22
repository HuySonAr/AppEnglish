import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ContentResponseCode,
  LESSON_TEST_PARTS,
  MOCK_TEST_LEVELS,
  MOCK_TEST_PART_COUNTS,
  MediaSection,
} from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { deleteMockTest, unpublishMockTest } from '../api/content-api.js';
import { notify } from '../../../lib/notify.js';
import {
  getMockTest,
  publishMockTest,
  saveMockTestDraft,
  updateMockTest,
} from '../api/content-api.js';
import { MockPartEditor } from '../components/MockPartEditor.jsx';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { issueLocation, lessonState, setIn } from '../lib/lesson-draft.js';
import {
  MOCK_FIRST_QUESTION_NUMBERS,
  mockIssueLabel,
  mockQuestionCount,
  workingMock,
} from '../lib/mock-draft.js';
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
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';

const saveErrorMessage = (error) =>
  `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;
const fullQuestionCount = Object.values(MOCK_TEST_PART_COUNTS).reduce((sum, count) => sum + count, 0);

// Editor of one mock test: its details (title, level, minutes) and the
// questions of its seven parts.
export function MockTestEditorPage() {
  const { mockTestId } = useParams();
  const [state, setState] = useState('loading');
  const [mockTest, setMockTest] = useState(null);
  const [details, setDetails] = useState({ title: '', level: '1', durationMinutes: '' });
  const navigate = useNavigate();
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const publish = usePublishAction();
  const [issues, setIssues] = useState([]);
  const [partTab, setPartTab] = useState(LESSON_TEST_PARTS[0].key);

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.MOCK });

  function applyDetails(data) {
    setMockTest(data);
    setDetails({ title: data.title, level: String(data.level), durationMinutes: String(data.durationMinutes) });
  }

  function apply(data) {
    applyDetails(data.mockTest);
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingMock(data));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getMockTest(mockTestId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the mock test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [mockTestId]);

  // Leaving with unsaved edits asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Saving first uploads the files chosen since the last save.
  async function saveDraft({ quiet = false } = {}) {
    const result = await draftMedia.uploadAll(content);
    if (result.uploadedAny) setContent(result.content);
    if (result.error) throw result.error;
    const data = (await saveMockTestDraft(mockTestId, result.content)).data;
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
      const data = (await publishMockTest(mockTestId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}` });
      return true;
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        const location = issueLocation(found[0].path);
        if (location.part) setPartTab(location.part);
        notify({
          title: 'The mock test cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({ title: 'Could not publish the mock test', description: saveErrorMessage(error), variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const changes = { title: details.title.trim(), level: Number(details.level), durationMinutes: Number(details.durationMinutes) };
      applyDetails((await updateMockTest(mockTestId, changes)).data.mockTest);
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
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/content-manager/mock-tests">
          Back to mock tests
        </Link>
      </div>
    );

  const minutes = Number(details.durationMinutes);
  const detailsValid = details.title.trim() && Number.isInteger(minutes) && minutes >= 1 && minutes <= 300;
  const detailsChanged =
    details.title.trim() !== mockTest.title || Number(details.level) !== mockTest.level || minutes !== mockTest.durationMinutes;
  const total = mockQuestionCount(content);
  // The questions a part holds in a full test, numbered 1-200 across the parts.
  const rangeOf = (key) => {
    const first = MOCK_FIRST_QUESTION_NUMBERS[key];
    return `${first}–${first + MOCK_TEST_PART_COUNTS[key] - 1}`;
  };

  return (
    <section className="space-y-6">
      <Link
        to="/content-manager/mock-tests"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mock tests
      </Link>

      <form onSubmit={onSaveDetails} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="mock-title">Title</Label>
          <Input id="mock-title" value={details.title} maxLength={200} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-level">Level</Label>
          <Select value={details.level} onValueChange={(level) => setDetails({ ...details, level })}>
            <SelectTrigger id="mock-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_TEST_LEVELS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  Level {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-minutes">Minutes</Label>
          <Input id="mock-minutes" inputMode="numeric" value={details.durationMinutes} onChange={(event) => setDetails({ ...details, durationMinutes: event.target.value.trim() })} />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !detailsValid || !detailsChanged}>
          Save details
        </Button>
      </form>

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {status.publishedVersion ? (
          <Badge variant="success">Published v{status.publishedVersion}</Badge>
        ) : (
          <Badge variant="outline">Not published</Badge>
        )}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        {mockTest.examType ? <Badge variant="info">{mockTest.examType.name}</Badge> : null}
        <Badge variant={total === fullQuestionCount ? 'success' : 'secondary'}>
          {total} / {fullQuestionCount} questions
        </Badge>
        <div className="ml-auto flex gap-2">
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !(dirty || status.hasDraft)} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? (
            <DiscardDraftButton kind="mockTest" id={mockTestId} noun="mock test" disabled={busy} onDiscarded={load} />
          ) : null}
          <ContentDangerActions
            noun="mock test"
            published={Boolean(status.publishedVersion)}
            busy={busy}
            onUnpublish={async () => setStatus(lessonState((await unpublishMockTest(mockTestId)).data))}
            onDelete={async () => {
              await deleteMockTest(mockTestId);
              navigate('/content-manager/mock-tests', { replace: true });
            }}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        A full TOEIC test has {fullQuestionCount} questions; a mock test can be published with fewer
        as long as every part has at least one. Title, level and minutes apply at once; questions
        reach learners when you publish, and publishing again creates a new version.
      </p>

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="font-medium underline-offset-4 hover:underline"
                  onClick={() => {
                    const location = issueLocation(issue.path);
                    if (location.part) setPartTab(location.part);
                  }}
                >
                  {mockIssueLabel(issue.path, content)}
                </button>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs value={partTab} onValueChange={setPartTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {LESSON_TEST_PARTS.map((spec) => (
            <TabsTrigger key={spec.key} value={spec.key}>
              Part {spec.number} ({rangeOf(spec.key)})
            </TabsTrigger>
          ))}
        </TabsList>
        {LESSON_TEST_PARTS.map((spec) => (
          <TabsContent key={spec.key} value={spec.key}>
            <MockPartEditor
              spec={spec}
              part={content.test[spec.key]}
              edit={edit}
              updatePart={(change) =>
                update((current) => ({ ...current, test: { ...current.test, [spec.key]: change(current.test[spec.key]) } }))
              }
              media={draftMedia.media}
            />
          </TabsContent>
        ))}
      </Tabs>

      <VersionHistory kind="mockTest" id={mockTestId} noun="mock test" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

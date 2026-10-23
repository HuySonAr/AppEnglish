import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import {
  ContentResponseCode,
  LESSON_TEST_PARTS,
  MOCK_TEST_LEVELS,
  MOCK_TEST_PART_COUNTS,
  MediaSection,
  Skill,
} from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { deleteMockTest, unpublishMockTest } from '../api/content-api.js';
import { notify } from '../../../lib/notify.js';
import {
  getMockTest,
  listMockTranscribe,
  publishMockTest,
  requestMockTranscribe,
  saveMockTestDraft,
  updateMockTest,
} from '../api/content-api.js';
import { MockPartEditor } from '../components/MockPartEditor.jsx';
import { SectionNav } from '../components/SectionNav.jsx';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { issueLocation, lessonState, setIn } from '../lib/lesson-draft.js';
import { mockIssueLabel, mockQuestionCount, workingMock } from '../lib/mock-draft.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';

const saveErrorMessage = (error) =>
  `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;
const fullQuestionCount = Object.values(MOCK_TEST_PART_COUNTS).reduce((sum, count) => sum + count, 0);
const skillLabels = { [Skill.LISTENING]: 'Listening', [Skill.READING]: 'Reading' };

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
  const [transcribeJobs, setTranscribeJobs] = useState({});
  const [dismissedJobs, setDismissedJobs] = useState(() => new Set());

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
    loadTranscribe();
  }, [mockTestId]);

  async function loadTranscribe() {
    try {
      const { jobs } = (await listMockTranscribe(mockTestId)).data;
      setTranscribeJobs(Object.fromEntries(jobs.map((job) => [job.audioMediaId, job])));
    } catch {
      setTranscribeJobs((current) => ({ ...current }));
    }
  }

  const transcribing = Object.values(transcribeJobs).some((job) => job.status === 'QUEUED' || job.status === 'RUNNING');
  useEffect(() => {
    if (!transcribing) return undefined;
    const timer = setTimeout(loadTranscribe, 3000);
    return () => clearTimeout(timer);
  }, [transcribeJobs, transcribing]);

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
    const data = (await saveMockTestDraft(mockTestId, result.content)).data;
    apply(data);
    draftMedia.reset();
    if (!quiet) notify({ title: `Draft saved (version ${data.draft.versionNumber})` });
    return result.content;
  }

  const speech = {
    jobOf: (audioMediaId) => {
      const job = transcribeJobs[audioMediaId];
      return job && !dismissedJobs.has(job.id) ? job : null;
    },
    dismiss: (job) => setDismissedJobs((current) => new Set(current).add(job.id)),
    request: async (path) => {
      try {
        const saved = dirty ? await saveDraft({ quiet: true }) : content;
        const audioMediaId = [...path, 'audioMediaId'].reduce((value, key) => value?.[key], saved);
        const { job } = (await requestMockTranscribe(mockTestId, audioMediaId)).data;
        setTranscribeJobs((current) => ({ ...current, [audioMediaId]: { ...job, audioMediaId } }));
      } catch (error) {
        notify({ title: 'Could not start transcribe', description: saveErrorMessage(error), variant: 'destructive' });
      }
    },
  };

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
  const issuesOf = (key) => issues.filter((issue) => issueLocation(issue.path).part === key).length;
  const spec = LESSON_TEST_PARTS.find((item) => item.key === partTab);
  const groups = [Skill.LISTENING, Skill.READING].map((skill) => ({
    label: skillLabels[skill],
    items: LESSON_TEST_PARTS.filter((item) => item.skill === skill).map((item) => {
      const count = content.test[item.key].questions.length;
      const target = MOCK_TEST_PART_COUNTS[item.key];
      return { key: item.key, title: `Part ${item.number}`, detail: `${count}/${target} · ${item.title}`, done: count >= target, issues: issuesOf(item.key), progress: (count * 100) / target };
    }),
  }));

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'Mock tests', to: '/content-manager/mock-tests' }, { label: mockTest.title }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{mockTest.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{[mockTest.examType?.name, `Level ${mockTest.level}`, `${mockTest.durationMinutes} min`].filter(Boolean).join(' · ')}</span>
            <Badge variant={total === fullQuestionCount ? 'success' : 'secondary'} className="tabular-nums">
              {total}/{fullQuestionCount} questions
            </Badge>
            {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
            {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status.publishedVersion ? (
            <Button asChild variant="ghost" className="gap-1.5">
              <Link to={`/content-manager/mock-tests/${mockTestId}/results`}>
                <BarChart3 className="h-4 w-4" />
                Results
              </Link>
            </Button>
          ) : null}
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !(dirty || status.hasDraft)} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? <DiscardDraftButton kind="mockTest" id={mockTestId} noun="mock test" disabled={busy} onDiscarded={load} size="icon" /> : null}
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

      <form onSubmit={onSaveDetails} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="mock-title">Title</Label>
          <Input id="mock-title" value={details.title} maxLength={200} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <div className="flex gap-1">
            {MOCK_TEST_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={details.level === String(level)}
                onClick={() => setDetails({ ...details, level: String(level) })}
                className={cn(
                  'h-10 min-w-11 rounded-md border px-2.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  details.level === String(level) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-minutes">Minutes</Label>
          <Input id="mock-minutes" className="w-24" inputMode="numeric" value={details.durationMinutes} onChange={(event) => setDetails({ ...details, durationMinutes: event.target.value.trim() })} />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !detailsValid || !detailsChanged}>
          Save details
        </Button>
      </form>

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

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <SectionNav label="Parts" groups={groups} active={partTab} onChoose={setPartTab} />

        <div className="min-w-0">
          <MockPartEditor
            key={spec.key}
            spec={spec}
            part={content.test[spec.key]}
            edit={edit}
            updatePart={(change) => update((current) => ({ ...current, test: { ...current.test, [spec.key]: change(current.test[spec.key]) } }))}
            media={draftMedia.media}
            speech={speech}
          />
        </div>
      </div>

      <VersionHistory kind="mockTest" id={mockTestId} noun="mock test" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

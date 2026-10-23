import { useEffect, useState } from 'react';
import { ContentResponseCode, LESSON_TEST_PARTS, MediaSection, Skill } from '@appenglish/content-contracts';
import { PLACEMENT_DURATION_MINUTES } from '@appenglish/learning-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  getPlacementTest,
  publishPlacementTest,
  savePlacementDraft,
} from '../api/content-api.js';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import {
  issueLabel,
  issueLocation,
  lessonState,
  setIn,
  workingPlacement,
} from '../lib/lesson-draft.js';
import { Badge, Button } from '../../../components/ui';
import { PartEditor, partAnswered } from '../components/PartEditor.jsx';
import { SectionNav } from '../components/SectionNav.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';

const saveErrorMessage = (error) =>
  `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

export function PlacementEditorPage() {
  const [state, setState] = useState('loading');
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
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.PLACEMENT });

  function apply(data) {
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingPlacement(data));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getPlacementTest()).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({
        title: 'Could not load the placement test',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    const data = (await savePlacementDraft(result.content)).data;
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
      const data = (await publishPlacementTest()).data;
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
          title: 'The placement test cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({
          title: 'Could not publish the placement test',
          description: saveErrorMessage(error),
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <EditorPageSkeleton />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const issuesOf = (key) => issues.filter((issue) => issueLocation(issue.path).part === key).length;
  const answeredTotal = LESSON_TEST_PARTS.reduce((sum, spec) => sum + partAnswered(content.test[spec.key]), 0);
  const questionTotal = LESSON_TEST_PARTS.reduce((sum, spec) => sum + spec.questionCount, 0);
  const groups = [Skill.LISTENING, Skill.READING].map((skill) => ({
    label: skill === Skill.LISTENING ? 'Listening' : 'Reading',
    items: LESSON_TEST_PARTS.filter((spec) => spec.skill === skill).map((spec) => {
      const answered = partAnswered(content.test[spec.key]);
      return {
        key: spec.key,
        title: `Part ${spec.number}`,
        detail: `${answered}/${spec.questionCount} answered`,
        done: answered === spec.questionCount,
        issues: issuesOf(spec.key),
        progress: (answered * 100) / spec.questionCount,
      };
    }),
  }));
  const spec = LESSON_TEST_PARTS.find((item) => item.key === partTab);

  return (
    <section className="space-y-5">
      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Content Manager</p>
          <h1 className="truncate text-lg font-semibold sm:text-xl">Placement test</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{PLACEMENT_DURATION_MINUTES} min</span>
            <Badge variant={answeredTotal === questionTotal ? 'success' : 'secondary'} className="tabular-nums">
              {answeredTotal}/{questionTotal} answered
            </Badge>
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
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Learners already taking the test finish the version they started.</p>

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
                  {issueLabel(issue.path)}
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
          <PartEditor key={spec.key} spec={spec} part={content.test[spec.key]} edit={edit} media={draftMedia.media} />
        </div>
      </div>
    </section>
  );
}

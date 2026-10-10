import { useEffect, useState } from 'react';
import {
  ContentResponseCode,
  LESSON_TEST_PARTS,
  MediaSection,
} from '@appenglish/content-contracts';
import { PLACEMENT_DURATION_MINUTES } from '@appenglish/learning-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../hooks/use-toast.js';
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
import {
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { PartEditor, questionRange } from '../components/PartEditor.jsx';

const saveErrorMessage = (error) =>
  `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

// Editor of the single placement test: the same seven parts and 23 questions
// as a lesson test.
export function PlacementEditorPage() {
  const { toast } = useToast();
  const [state, setState] = useState('loading');
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
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
      toast({
        title: 'Could not load the placement test',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    const data = (await savePlacementDraft(result.content)).data;
    apply(data);
    draftMedia.reset();
    if (!quiet) toast({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      toast({
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
      toast({ title: `Published version ${data.published.versionNumber}` });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        const location = issueLocation(found[0].path);
        if (location.part) setPartTab(location.part);
        toast({
          title: 'The placement test cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Could not publish the placement test',
          description: saveErrorMessage(error),
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <Skeleton className="h-96 w-full" />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Content Manager"
        title="Placement test"
        description={`One test for every new learner: seven parts, 23 questions, ${PLACEMENT_DURATION_MINUTES} minutes. Each learner takes it once; the score decides the unit they start at.`}
      />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {status.publishedVersion ? (
          <Badge variant="success">Published v{status.publishedVersion}</Badge>
        ) : (
          <Badge variant="outline">Not published</Badge>
        )}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <Button disabled={busy || !(dirty || status.hasDraft)} onClick={onPublish}>
            Publish
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Learners get the published version. Publishing again creates a new
        version: learners who have not started get it, a learner in the middle
        of the test finishes the version they started, and earlier results are
        kept. Audio and images you choose are previewed here and uploaded when
        you save.
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
                  {issueLabel(issue.path)}
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
              Part {spec.number} ({questionRange(spec, '')})
            </TabsTrigger>
          ))}
        </TabsList>
        {LESSON_TEST_PARTS.map((spec) => (
          <TabsContent key={spec.key} value={spec.key}>
            <PartEditor spec={spec} part={content.test[spec.key]} edit={edit} media={draftMedia.media} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

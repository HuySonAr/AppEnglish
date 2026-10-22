import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ContentResponseCode, UNIT_REVIEW_PART_COUNTS, UNIT_REVIEW_PASSAGE_COUNT, UNIT_REVIEW_PASSAGE_QUESTIONS, UNIT_REVIEW_QUESTION_COUNT } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { getUnitReview, publishUnitReview, saveUnitReviewDraft, unpublishUnitReview } from '../api/content-api.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { ImportExportJson } from '../components/ImportExportJson.jsx';
import { exportReview, jsonFileName, planReviewImport } from '../lib/authoring-import.js';
import { MockPartEditor } from '../components/MockPartEditor.jsx';
import { issueLocation, lessonState, setIn } from '../lib/lesson-draft.js';
import {
  UNIT_REVIEW_FIRST_NUMBERS,
  UNIT_REVIEW_LIMITS,
  UNIT_REVIEW_SPECS,
  unitReviewComplete,
  unitReviewIssueLabel,
  unitReviewQuestionCount,
  workingUnitReview,
} from '../lib/unit-review-draft.js';
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { PublishButton, usePublishAction } from '../../../components/shared/PublishButton.jsx';
import { useFocusReturn, useListLinkState, useReturnTo } from '../../../hooks/use-return-to.js';

const hints = {
  part5: `Reading · ${UNIT_REVIEW_PART_COUNTS.part5} sentences, each with one blank and four options; test the words of the unit, mostly as word forms`,
  part6: `Reading · ${UNIT_REVIEW_PASSAGE_COUNT} passages (email, memo, notice…) with exactly ${UNIT_REVIEW_PASSAGE_QUESTIONS} blanks each, written ___, one question of four options per blank`,
};

// Editor of the review that closes a unit (D121, D129): 10 Part 5 questions and 3
// Part 6 passages, saved as a draft and published as a version like a lesson.
export function UnitReviewEditorPage() {
  const { unitId } = useParams();
  const back = useReturnTo('/content-manager/units');
  const [state, setState] = useState('loading');
  const [unit, setUnit] = useState(null);
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const publish = usePublishAction();
  const [issues, setIssues] = useState([]);
  const [partTab, setPartTab] = useState(UNIT_REVIEW_SPECS[0].key);

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));

  function apply(data) {
    setUnit(data.unit);
    setStatus(lessonState(data));
    setContent(workingUnitReview(data));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getUnitReview(unitId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the unit review', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [unitId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function saveDraft({ quiet = false } = {}) {
    const data = (await saveUnitReviewDraft(unitId, content)).data;
    apply(data);
    if (!quiet) notify({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({ title: 'Could not save the draft', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ quiet: true });
      const data = (await publishUnitReview(unitId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}`, description: 'Learners who finish the unit now take this review before the next unit opens.' });
      return true;
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        const location = issueLocation(found[0].path);
        if (location.part) setPartTab(location.part);
        notify({
          title: 'The review cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({ title: 'Could not publish the review', description: getApiErrorMessage(error), variant: 'destructive' });
      }
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
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={back.to} state={back.state}>
          Back to units
        </Link>
      </div>
    );

  const total = unitReviewQuestionCount(content);
  const rangeOf = (key) => {
    const first = UNIT_REVIEW_FIRST_NUMBERS[key];
    return `${first}–${first + UNIT_REVIEW_LIMITS[key].target - 1}`;
  };

  return (
    <section className="space-y-6">
      <Link to={back.to} state={back.state} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Units and lessons
      </Link>
      <PageHeader
        eyebrow={`Unit ${unit.position}`}
        title={`Unit review: ${unit.title}`}
        description={`${UNIT_REVIEW_PART_COUNTS.part5} sentences (Part 5) and ${UNIT_REVIEW_PASSAGE_COUNT} passages of ${UNIT_REVIEW_PASSAGE_QUESTIONS} blanks (Part 6), ${UNIT_REVIEW_QUESTION_COUNT} questions.`}
      />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        <Badge variant={unitReviewComplete(content) ? 'success' : 'secondary'}>
          {total} / {UNIT_REVIEW_QUESTION_COUNT} questions
        </Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <ImportExportJson
            noun="unit review"
            disabled={busy}
            plan={planReviewImport}
            onImport={(imported) => {
              setContent(imported);
              setDirty(true);
              setIssues([]);
            }}
            exportData={() => exportReview(content, { unit: unit.position, title: unit.title })}
            fileName={jsonFileName(`${unit.title}-review`)}
          />
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <PublishButton state={publish.state} disabled={busy || !(dirty || status.hasDraft)} onClick={() => publish.run(onPublish)} />
          {status.hasDraft ? (
            <DiscardDraftButton kind="unitReview" id={unitId} noun="unit review" disabled={busy} onDiscarded={load} />
          ) : null}
          <ContentDangerActions
            noun="unit review"
            published={Boolean(status.publishedVersion)}
            busy={busy}
            deletable={false}
            onUnpublish={async () => apply((await unpublishUnitReview(unitId)).data)}
          />
        </div>
      </div>

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
                  {unitReviewIssueLabel(issue.path)}
                </button>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs value={partTab} onValueChange={setPartTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {UNIT_REVIEW_SPECS.map((spec) => (
            <TabsTrigger key={spec.key} value={spec.key}>
              Part {spec.number} ({rangeOf(spec.key)})
            </TabsTrigger>
          ))}
        </TabsList>
        {UNIT_REVIEW_SPECS.map((spec) => (
          <TabsContent key={spec.key} value={spec.key}>
            <MockPartEditor
              spec={spec}
              part={content.test[spec.key]}
              edit={edit}
              updatePart={(change) => update((current) => ({ ...current, test: { ...current.test, [spec.key]: change(current.test[spec.key]) } }))}
              media={{}}
              target={UNIT_REVIEW_LIMITS[spec.key].target}
              firstNumber={UNIT_REVIEW_FIRST_NUMBERS[spec.key]}
              maxSets={UNIT_REVIEW_LIMITS[spec.key].maxSets}
              setQuestionLimit={UNIT_REVIEW_LIMITS[spec.key].setQuestionLimit}
              hint={hints[spec.key]}
              paste={false}
            />
          </TabsContent>
        ))}
      </Tabs>

      <VersionHistory kind="unitReview" id={unitId} noun="unit review" refreshKey={`${status.publishedVersion}-${status.draftVersion}`} onRestored={load} />
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import {
  ContentResponseCode,
  ContentReviewKind,
  LessonVersionStatus,
  UNIT_REVIEW_PART_COUNTS,
  UNIT_REVIEW_PASSAGE_COUNT,
  UNIT_REVIEW_PASSAGE_QUESTIONS,
  UNIT_REVIEW_QUESTION_COUNT,
} from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { getUnitReview, saveUnitReviewDraft, submitContentReview, unpublishUnitReview } from '../api/content-api.js';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { ImportExportJson } from '../components/ImportExportJson.jsx';
import { exportReview, jsonFileName, planReviewImport } from '../lib/authoring-import.js';
import { MockPartEditor } from '../components/MockPartEditor.jsx';
import { SectionNav } from '../components/SectionNav.jsx';
import { ReadOnlyProvider } from '../components/ReadOnly.jsx';
import {
  ChangesFromPublished,
  ManagerReviewActions,
  ReviewBanner,
  ReviewStatusBadge,
  SubmitForReviewButton,
  reviewErrorMessage,
} from '../components/ContentReview.jsx';
import { useContentArea } from '../hooks/use-content-area.js';
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
import { Badge, Button } from '../../../components/ui';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { useReturnTo } from '../../../hooks/use-return-to.js';

const KIND = ContentReviewKind.UNIT_REVIEW;
const hints = {
  part5: `${UNIT_REVIEW_PART_COUNTS.part5} sentences that test the unit's words, mostly as word forms.`,
  part6: `${UNIT_REVIEW_PASSAGE_COUNT} short passages with ${UNIT_REVIEW_PASSAGE_QUESTIONS} blanks each, written ___.`,
};

export function UnitReviewEditorPage() {
  const { unitId } = useParams();
  const { base, canAuthor, canManage } = useContentArea();
  const back = useReturnTo(`${base}/units`);
  const [state, setState] = useState('loading');
  const [unit, setUnit] = useState(null);
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [compare, setCompare] = useState({ draft: null, published: null });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setCompare({ draft: data.draft?.content ?? null, published: data.published?.content ?? null });
    setDirty(false);
  }

  async function refresh() {
    apply((await getUnitReview(unitId)).data);
    setIssues([]);
  }

  async function load() {
    setState('loading');
    try {
      await refresh();
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
    setBusy('save');
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({ title: 'Could not save the draft', description: reviewErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setBusy('submit');
    try {
      if (dirty) await saveDraft({ quiet: true });
      await submitContentReview(KIND, unitId);
      await refresh();
      notify({ title: 'Sent for review' });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        const location = issueLocation(found[0].path);
        if (location.part) setPartTab(location.part);
        notify({
          title: 'The review cannot be sent yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({ title: 'Could not submit the review', description: reviewErrorMessage(error), variant: 'destructive' });
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

  const locked = status.draftStatus === LessonVersionStatus.PENDING_REVIEW;
  const readOnly = !canAuthor || locked;
  const total = unitReviewQuestionCount(content);
  const spec = UNIT_REVIEW_SPECS.find((item) => item.key === partTab);
  const issuesOf = (key) => issues.filter((issue) => issueLocation(issue.path).part === key).length;
  const groups = [
    {
      label: 'Reading',
      items: UNIT_REVIEW_SPECS.map((item) => {
        const part = content.test[item.key];
        const count = part.questions.length;
        const target = UNIT_REVIEW_LIMITS[item.key].target;
        const sets = item.key === 'part6' ? `${part.groups.length}/${UNIT_REVIEW_PASSAGE_COUNT} passages · ` : '';
        return { key: item.key, title: `Part ${item.number}`, detail: `${sets}${count}/${target} questions`, done: count >= target, issues: issuesOf(item.key), progress: (count * 100) / target };
      }),
    },
  ];

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'Units and lessons', to: back.to, state: back.state }, { label: `Unit ${unit.position}: ${unit.title}` }, { label: 'Unit review' }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">Unit review: {unit.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Unit {unit.position}</span>
            <Badge variant={unitReviewComplete(content) ? 'success' : 'secondary'} className="tabular-nums">
              {total}/{UNIT_REVIEW_QUESTION_COUNT} questions
            </Badge>
            {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
            {status.hasDraft ? <ReviewStatusBadge status={status.draftStatus} version={status.draftVersion} /> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAuthor && !locked ? (
            <>
              <ImportExportJson
                noun="unit review"
                disabled={Boolean(busy)}
                plan={planReviewImport}
                onImport={(imported) => {
                  setContent(imported);
                  setDirty(true);
                  setIssues([]);
                }}
                exportData={() => exportReview(content, { unit: unit.position, title: unit.title })}
                fileName={jsonFileName(`${unit.title}-review`)}
              />
              <Button loading={busy === 'save'} variant="outline" disabled={Boolean(busy) || !dirty} onClick={onSave}>
                Save draft
              </Button>
              <SubmitForReviewButton loading={busy === 'submit'} disabled={Boolean(busy) || !(dirty || status.hasDraft)} onClick={onSubmit} />
              {status.hasDraft ? <DiscardDraftButton kind="unitReview" id={unitId} noun="unit review" disabled={Boolean(busy)} onDiscarded={load} size="icon" /> : null}
            </>
          ) : null}
          {canManage && locked ? <ManagerReviewActions kind={KIND} id={unitId} disabled={Boolean(busy)} onChanged={refresh} /> : null}
          {canManage ? (
            <ContentDangerActions noun="unit review" published={Boolean(status.publishedVersion)} busy={Boolean(busy)} deletable={false} onUnpublish={async () => { await unpublishUnitReview(unitId); await refresh(); }} />
          ) : null}
        </div>
      </div>

      <ReviewBanner kind={KIND} id={unitId} status={status.draftStatus} note={status.reviewNote} canAuthor={canAuthor} disabled={Boolean(busy)} onChanged={refresh} />

      {canManage ? <ChangesFromPublished kind={KIND} draft={compare.draft} published={compare.published} /> : null}

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before submitting ({issues.length}):</p>
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

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <SectionNav label="Parts" groups={groups} active={partTab} onChoose={setPartTab} />

        <div className="min-w-0">
          <ReadOnlyProvider value={readOnly}>
            <MockPartEditor
              key={spec.key}
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
          </ReadOnlyProvider>
        </div>
      </div>

      <VersionHistory
        kind="unitReview"
        id={unitId}
        noun="unit review"
        refreshKey={`${status.publishedVersion}-${status.draftVersion}-${status.draftStatus}`}
        onRestored={load}
        canRestore={canAuthor && !locked}
        canDiscard={canAuthor && !locked}
        canDeleteVersion={canManage}
      />
    </section>
  );
}

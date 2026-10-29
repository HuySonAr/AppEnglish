import { useEffect, useState } from 'react';
import { AudioLines } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContentResponseCode, ContentReviewKind, LessonVersionStatus, MediaKind, MediaSection, PRACTICE_LIMITS, SwSection } from '@appenglish/content-contracts';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { createPracticeMachineAudio } from '../../../lib/api/practice-prompts-api.js';
import { notify } from '../../../lib/notify.js';
import { etsTaskLabels } from '../../../lib/practice-prompts.js';
import { EtsTiming } from '../../teacher/components/PromptEditorParts.jsx';
import { ContentDangerActions } from '../components/ContentDangerActions.jsx';
import { ChangesFromPublished, ManagerReviewActions, ReviewBanner, ReviewStatusBadge, SubmitForReviewButton, reviewErrorMessage } from '../components/ContentReview.jsx';
import { DiscardDraftButton } from '../components/DiscardDraftButton.jsx';
import { MediaField } from '../components/MediaField.jsx';
import { ReadOnlyProvider, useReadOnly } from '../components/ReadOnly.jsx';
import { SectionNav } from '../components/SectionNav.jsx';
import { TextField } from '../components/TextField.jsx';
import { VersionHistory } from '../components/VersionHistory.jsx';
import { useContentArea } from '../hooks/use-content-area.js';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { lessonState, setIn } from '../lib/lesson-draft.js';
import { blockId, blockProgress, numbersLabel, sectionLabels, swBlockOf, swBlocks, swIssueBlock, swIssueLabel, workingSwTest } from '../lib/sw-test-draft.js';
import { deleteSwTest, getSwTest, saveSwTestDraft, submitContentReview, unpublishSwTest, updateSwTest } from '../api/content-api.js';
import { useSpeechTasks } from '../../../hooks/use-speech-tasks.js';

const KIND = ContentReviewKind.SW_TEST;
const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${reviewErrorMessage(error)}`;

function Numbered({ number, title, children }) {
  return (
    <div className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums text-primary">{number}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function VoiceButton({ text, state, onMake }) {
  const readOnly = useReadOnly();
  if (readOnly) return null;
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" loading={state === 'running'} disabled={Boolean(state) || !text.trim()} onClick={onMake}>
      <AudioLines className="h-4 w-4" />
      {state === 'waiting' ? 'Waiting…' : state === 'running' ? 'Making…' : 'Machine voice'}
    </Button>
  );
}

function AskedQuestion({ id, number, item, path, edit, media, voice }) {
  return (
    <Numbered number={number} title={`Question ${number}`}>
      <TextField id={`${id}-text`} label="Question" value={item.text} maxLength={PRACTICE_LIMITS.question} onChange={(value) => edit([...path, 'text'], value)} />
      <MediaField id={`${id}-audio`} label="Question audio" kind={MediaKind.AUDIO} path={[...path, 'audioMediaId']} mediaId={item.audioMediaId} media={media} />
      {item.audioMediaId ? null : <VoiceButton text={item.text} state={voice.state(path)} onMake={() => voice.make(path, item.text)} />}
    </Numbered>
  );
}

function BlockEditor({ block, content, edit, media, voice }) {
  const { speaking, writing } = content;
  const base = [block.section, block.key];
  const number = (index) => block.first + index;

  if (block.key === 'readAloud')
    return speaking.readAloud.map((item, index) => (
      <Numbered key={index} number={number(index)} title={`Question ${number(index)}`}>
        <TextField id={`sw-read-${index}`} label="Text to read" multiline rows={4} value={item.text} maxLength={PRACTICE_LIMITS.readAloudText} onChange={(value) => edit([...base, index, 'text'], value)} />
      </Numbered>
    ));

  if (block.key === 'pictures')
    return speaking.pictures.map((item, index) => (
      <Numbered key={index} number={number(index)} title={`Question ${number(index)}`}>
        <MediaField id={`sw-picture-${index}`} label="Picture" kind={MediaKind.IMAGE} path={[...base, index, 'imageMediaId']} mediaId={item.imageMediaId} media={media} />
      </Numbered>
    ));

  if (block.key === 'respondQuestions')
    return (
      <>
        <TextField
          id="sw-context"
          label="Context"
          multiline
          rows={3}
          value={speaking.respondQuestions.context}
          maxLength={PRACTICE_LIMITS.context}
          onChange={(value) => edit([...base, 'context'], value)}
        />
        {speaking.respondQuestions.questions.map((item, index) => (
          <AskedQuestion key={index} id={`sw-rq-${index}`} number={number(index)} item={item} path={[...base, 'questions', index]} edit={edit} media={media} voice={voice} />
        ))}
      </>
    );

  if (block.key === 'respondInfo')
    return (
      <>
        <TextField
          id="sw-info"
          label="Information (a table row: | cell | cell |)"
          multiline
          rows={8}
          value={speaking.respondInfo.info}
          maxLength={PRACTICE_LIMITS.info}
          onChange={(value) => edit([...base, 'info'], value)}
        />
        {speaking.respondInfo.info.trim() ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Preview</p>
            <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed">
              <PassageText text={speaking.respondInfo.info} />
            </div>
          </div>
        ) : null}
        {speaking.respondInfo.questions.map((item, index) => (
          <AskedQuestion key={index} id={`sw-ri-${index}`} number={number(index)} item={item} path={[...base, 'questions', index]} edit={edit} media={media} voice={voice} />
        ))}
      </>
    );

  if (block.key === 'opinion')
    return (
      <Numbered number={block.first} title={`Question ${block.first}`}>
        <TextField id="sw-opinion" label="Question" multiline rows={3} value={speaking.opinion.text} maxLength={PRACTICE_LIMITS.instructions} onChange={(value) => edit([...base, 'text'], value)} />
        <MediaField id="sw-opinion-audio" label="Question audio (optional)" kind={MediaKind.AUDIO} path={[...base, 'audioMediaId']} mediaId={speaking.opinion.audioMediaId} media={media} />
        {speaking.opinion.audioMediaId ? null : <VoiceButton text={speaking.opinion.text} state={voice.state(base)} onMake={() => voice.make(base, speaking.opinion.text)} />}
      </Numbered>
    );

  if (block.key === 'pictureSentences')
    return writing.pictureSentences.map((item, index) => (
      <Numbered key={index} number={number(index)} title={`Question ${number(index)}`}>
        <MediaField id={`sw-sentence-${index}`} label="Picture" kind={MediaKind.IMAGE} path={[...base, index, 'imageMediaId']} mediaId={item.imageMediaId} media={media} />
        <div className="grid gap-3 sm:grid-cols-2">
          {item.keywords.map((word, wordIndex) => (
            <TextField
              key={wordIndex}
              id={`sw-sentence-${index}-word-${wordIndex}`}
              label={`Word ${wordIndex + 1}`}
              value={word}
              maxLength={PRACTICE_LIMITS.keyword}
              onChange={(value) => edit([...base, index, 'keywords', wordIndex], value)}
            />
          ))}
        </div>
      </Numbered>
    ));

  if (block.key === 'emails')
    return writing.emails.map((item, index) => (
      <Numbered key={index} number={number(index)} title={`Question ${number(index)}`}>
        <TextField id={`sw-email-${index}`} label="Email" multiline rows={8} value={item.email} maxLength={PRACTICE_LIMITS.email} onChange={(value) => edit([...base, index, 'email'], value)} />
        <TextField
          id={`sw-email-${index}-instructions`}
          label="Instructions"
          multiline
          rows={3}
          value={item.instructions}
          maxLength={PRACTICE_LIMITS.instructions}
          onChange={(value) => edit([...base, index, 'instructions'], value)}
        />
      </Numbered>
    ));

  return (
    <Numbered number={block.first} title={`Question ${block.first}`}>
      <TextField id="sw-essay" label="Essay question" multiline rows={4} value={writing.essay.question} maxLength={PRACTICE_LIMITS.instructions} onChange={(value) => edit([...base, 'question'], value)} />
    </Numbered>
  );
}

export function SwTestEditorPage() {
  const { swTestId } = useParams();
  const { base, canAuthor, canManage } = useContentArea();
  const listPath = `${base}/sw-tests`;
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [swTest, setSwTest] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [compare, setCompare] = useState({ draft: null, published: null });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const voices = useSpeechTasks();
  const [issues, setIssues] = useState([]);
  const [active, setActive] = useState(blockId(swBlocks[0]));

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.PRACTICE });

  function apply(data) {
    setSwTest(data.swTest);
    setTitle(data.swTest.title);
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingSwTest(data));
    setCompare({ draft: data.draft?.content ?? null, published: data.published?.content ?? null });
    setDirty(false);
  }

  async function refresh() {
    apply((await getSwTest(swTestId)).data);
    setIssues([]);
  }

  async function load() {
    setState('loading');
    try {
      await refresh();
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [swTestId]);

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
    const data = (await saveSwTestDraft(swTestId, result.content)).data;
    apply(data);
    draftMedia.reset();
    if (!quiet) notify({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy('save');
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      notify({ title: 'Could not save the draft', description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setBusy('submit');
    try {
      if (dirty) await saveDraft({ quiet: true });
      await submitContentReview(KIND, swTestId);
      await refresh();
      notify({ title: 'Sent for review' });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        const first = swIssueBlock(found[0].path);
        if (first) setActive(first);
        notify({ title: 'The test cannot be sent yet', description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`, variant: 'destructive' });
      } else notify({ title: 'Could not submit the test', description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveTitle(event) {
    event.preventDefault();
    setBusy('details');
    try {
      const saved = (await updateSwTest(swTestId, { title: title.trim() })).data.swTest;
      setSwTest(saved);
      setTitle(saved.title);
      notify({ title: 'Title saved' });
    } catch (error) {
      notify({ title: 'Could not save the title', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const voice = {
    state: (path) => (voices.isRunning(path.join('.')) ? 'running' : voices.isWaiting(path.join('.')) ? 'waiting' : null),
    make(path, text) {
      voices.start(path.join('.'), async () => {
        try {
          const { media: made } = (await createPracticeMachineAudio(text.trim())).data;
          draftMedia.setStored((current) => ({ ...current, [made.id]: { kind: MediaKind.AUDIO, fileName: made.fileName, url: made.url } }));
          edit([...path, 'audioMediaId'], made.id);
          notify({ title: 'Audio made' });
        } catch (error) {
          notify({ title: 'Could not make the audio', description: getApiErrorMessage(error), variant: 'destructive' });
        }
      });
    },
  };

  if (state === 'loading') return <EditorPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={listPath}>
          Back to S&W tests
        </Link>
      </div>
    );

  const locked = status.draftStatus === LessonVersionStatus.PENDING_REVIEW;
  const readOnly = !canAuthor || locked;
  const working = Boolean(busy) || voices.busy;
  const block = swBlockOf(active) || swBlocks[0];
  const issuesOf = (id) => issues.filter((issue) => swIssueBlock(issue.path) === id).length;
  const groups = [SwSection.SPEAKING, SwSection.WRITING].map((section) => ({
    label: sectionLabels[section],
    items: swBlocks
      .filter((item) => item.section === section)
      .map((item) => {
        const progress = blockProgress(content, item);
        const last = item.first + item.count - 1;
        return {
          key: blockId(item),
          title: `${item.first}${last > item.first ? `–${last}` : ''} · ${etsTaskLabels[item.task]}`,
          detail: `${progress.filled}/${progress.total} ready`,
          done: progress.filled === progress.total,
          issues: issuesOf(blockId(item)),
          progress: (progress.filled * 100) / progress.total,
        };
      }),
  }));
  const ready = swBlocks.every((item) => {
    const progress = blockProgress(content, item);
    return progress.filled === progress.total;
  });
  const removeTest = async () => {
    await deleteSwTest(swTestId);
    navigate(listPath, { replace: true });
  };

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'S&W tests', to: listPath }, { label: swTest.title }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-5 sm:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{swTest.title}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Speaking 11 · Writing 8</span>
            <Badge variant={ready ? 'success' : 'secondary'}>{ready ? 'All questions ready' : 'In progress'}</Badge>
            {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
            {status.hasDraft ? <ReviewStatusBadge status={status.draftStatus} version={status.draftVersion} /> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAuthor && !locked ? (
            <>
              <Button loading={busy === 'save'} variant="outline" disabled={working || !dirty} onClick={onSave}>
                Save draft
              </Button>
              <SubmitForReviewButton loading={busy === 'submit'} disabled={working || !(dirty || status.hasDraft)} onClick={onSubmit} />
              {status.hasDraft ? <DiscardDraftButton kind={KIND} id={swTestId} noun="test" disabled={working} onDiscarded={load} size="icon" /> : null}
            </>
          ) : null}
          {canManage && locked ? <ManagerReviewActions kind={KIND} id={swTestId} disabled={working} onChanged={refresh} /> : null}
          <ContentDangerActions
            noun="test"
            published={Boolean(status.publishedVersion)}
            busy={working}
            onUnpublish={
              canManage
                ? async () => {
                    await unpublishSwTest(swTestId);
                    await refresh();
                  }
                : undefined
            }
            onDelete={canManage || (canAuthor && !status.publishedVersion) ? removeTest : undefined}
          />
        </div>
      </div>

      <ReviewBanner kind={KIND} id={swTestId} status={status.draftStatus} note={status.reviewNote} canAuthor={canAuthor} disabled={working} onChanged={refresh} />

      {canManage ? <ChangesFromPublished kind={KIND} draft={compare.draft} published={compare.published} /> : null}

      {canAuthor ? (
        <form onSubmit={onSaveTitle} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="sw-test-title">Title</Label>
            <Input id="sw-test-title" value={title} maxLength={200} readOnly={locked} onChange={(event) => setTitle(event.target.value)} />
          </div>
          {locked ? null : (
            <Button type="submit" variant="outline" loading={busy === 'details'} disabled={working || !title.trim() || title.trim() === swTest.title}>
              Save title
            </Button>
          )}
        </form>
      ) : null}

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
                    const target = swIssueBlock(issue.path);
                    if (target) setActive(target);
                  }}
                >
                  {swIssueLabel(issue.path)}
                </button>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <SectionNav label="Questions" groups={groups} active={active} onChoose={setActive} />

        <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {sectionLabels[block.section]} · {numbersLabel(block)}
            </p>
            <h2 className="text-lg font-semibold">{etsTaskLabels[block.task]}</h2>
            <EtsTiming task={block.task} />
          </div>
          <ReadOnlyProvider value={readOnly}>
            <BlockEditor key={active} block={block} content={content} edit={edit} media={draftMedia.media} voice={voice} />
          </ReadOnlyProvider>
        </div>
      </div>

      <VersionHistory
        kind={KIND}
        id={swTestId}
        noun="test"
        refreshKey={`${status.publishedVersion}-${status.draftVersion}-${status.draftStatus}`}
        onRestored={load}
        canRestore={canAuthor && !locked}
        canDiscard={canAuthor && !locked}
        canDeleteVersion={canManage}
      />
    </section>
  );
}

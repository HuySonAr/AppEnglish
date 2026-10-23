import { useEffect, useState } from 'react';
import { AudioLines, Eye, Plus, Send, Trash2, Undo2, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CEFR_LEVELS, ContentResponseCode, PRACTICE_LIMITS, PracticePromptKind, PracticePromptStatus, WritingTaskType } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';
import { FileRow } from '../../../components/shared/FileRow.jsx';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PracticePromptView } from '../../../components/shared/PracticePromptView.jsx';
import {
  deletePracticePrompt,
  getPracticePrompt,
  savePracticePromptDraft,
  submitPracticePrompt,
  uploadPracticeMedia,
  createPracticeMachineAudio,
  withdrawPracticePrompt,
} from '../../../lib/api/practice-prompts-api.js';
import { countWords, fieldLabel, kindLabels, statusInfo, taskTypeLabels } from '../../../lib/practice-prompts.js';

const EDITABLE = new Set([PracticePromptStatus.DRAFT, PracticePromptStatus.RETURNED, PracticePromptStatus.PUBLISHED, PracticePromptStatus.ARCHIVED, PracticePromptStatus.UNPUBLISHED]);

function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-xs tabular-nums text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Choice({ value, current, onPick, children }) {
  return (
    <button
      type="button"
      aria-pressed={value === current}
      onClick={() => onPick(value)}
      className={cn(
        'h-9 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        value === current ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

function MediaInput({ id, label, kind, mediaId, media, onChange }) {
  const [uploading, setUploading] = useState(false);
  const asset = mediaId ? media[mediaId] : null;
  async function choose(file) {
    setUploading(true);
    try {
      const result = (await uploadPracticeMedia(kind, file)).data.media;
      onChange(result.id, { kind, fileName: result.fileName, url: result.url });
    } catch (error) {
      notify({ title: 'Could not upload the file', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }
  return (
    <Field id={id} label={label}>
      {mediaId ? (
        <FileRow name={asset?.fileName || 'File attached'} status="done" note="Uploaded" onRemove={() => onChange(null)}>
          {asset?.url && kind === 'audio' ? <audio controls src={asset.url} className="w-full" /> : null}
          {asset?.url && kind === 'image' ? <img src={asset.url} alt="" className="max-h-48 rounded-md" /> : null}
        </FileRow>
      ) : (
        <FileDropzone
          id={id}
          compact
          disabled={uploading}
          accept={kind === 'audio' ? '.mp3,.m4a,.mp4,audio/mpeg,audio/mp4' : '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'}
          kindLabel={uploading ? 'Uploading…' : kind === 'audio' ? 'MP3, MP4 or M4A' : 'JPEG, PNG or WebP'}
          onFile={choose}
        />
      )}
    </Field>
  );
}

export function PromptEditorPage() {
  const { promptId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [media, setMedia] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(null);
  const [issues, setIssues] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function apply(result) {
    setData(result);
    setContent(result.latest.content);
    setMedia(result.media || {});
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getPracticePrompt(promptId)).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the prompt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [promptId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (field) => (value) => {
    setContent((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };

  async function run(label, action, success) {
    setBusy(label);
    try {
      const result = await action();
      if (result?.data?.prompt) apply(result.data);
      if (success) notify({ title: success });
      setIssues([]);
      return true;
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        notify({ title: 'The prompt is not ready yet', description: `${found.length} field${found.length === 1 ? '' : 's'} to fill in.`, variant: 'destructive' });
      } else notify({ title: 'Could not do that', description: getApiErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const save = () => run('save', () => savePracticePromptDraft(promptId, content), 'Draft saved');
  async function makeVoice() {
    setBusy('voice');
    try {
      const { media: made } = (await createPracticeMachineAudio(content.text.trim())).data;
      setMedia((current) => ({ ...current, [made.id]: { kind: 'audio', fileName: made.fileName, url: made.url } }));
      set('audioMediaId')(made.id);
      notify({ title: 'Model audio made' });
    } catch (error) {
      notify({ title: 'Could not make the audio', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }
  const submit = () =>
    run('submit', async () => {
      if (dirty) await savePracticePromptDraft(promptId, content);
      return submitPracticePrompt(promptId);
    }, 'Sent for review');

  if (state === 'loading') return <EditorPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/teacher/prompts">
          Back to prompts
        </Link>
      </div>
    );

  const kind = data.prompt.kind;
  const status = data.latest.status;
  const pending = status === PracticePromptStatus.PENDING_REVIEW;
  const editable = EDITABLE.has(status);
  const canSubmit = status === PracticePromptStatus.DRAFT || status === PracticePromptStatus.RETURNED || (dirty && editable);
  const neverPublished = !data.published && !data.prompt.publishedVersionNumber;
  const words = countWords(content.sampleAnswer);

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: 'Prompts', to: '/teacher/prompts' }, { label: content.title || 'Untitled prompt' }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{content.title || 'Untitled prompt'}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {kindLabels[kind]} · {content.level} · version {data.latest.versionNumber}
            </span>
            <Badge variant={statusInfo[status].variant}>{statusInfo[status].label}</Badge>
            {data.published && data.published.id !== data.latest.id ? <Badge variant="success">Live v{data.published.versionNumber}</Badge> : null}
            {dirty ? <Badge variant="info">Unsaved</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="gap-1.5" onClick={() => setPreviewing(true)}>
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          {pending ? (
            <Button variant="outline" className="gap-1.5" loading={busy === 'withdraw'} disabled={Boolean(busy)} onClick={() => run('withdraw', () => withdrawPracticePrompt(promptId), 'Taken back from review')}>
              <Undo2 className="h-4 w-4" />
              Take back
            </Button>
          ) : (
            <>
              <Button variant="outline" loading={busy === 'save'} disabled={Boolean(busy) || !dirty} onClick={save}>
                Save draft
              </Button>
              <Button className="gap-1.5" loading={busy === 'submit'} disabled={Boolean(busy) || !canSubmit} onClick={submit}>
                <Send className="h-4 w-4" />
                Send for review
              </Button>
            </>
          )}
          {neverPublished && !pending ? (
            <Button variant="ghost" size="icon" aria-label="Delete prompt" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {status === PracticePromptStatus.RETURNED && data.latest.reviewNote ? (
        <div role="alert" className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="font-medium">Returned by the Content Manager</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{data.latest.reviewNote}</p>
        </div>
      ) : null}
      {pending ? <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Waiting for review. Take it back to make changes.</p> : null}
      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fill these in before sending:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{fieldLabel(issue.path)}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_14rem]">
          <Field id="prompt-title" label="Title" hint={`${content.title.length}/${PRACTICE_LIMITS.title}`}>
            <Input id="prompt-title" maxLength={PRACTICE_LIMITS.title} value={content.title} onChange={(event) => set('title')(event.target.value)} />
          </Field>
          <Field id="prompt-topic" label="Topic">
            <Input id="prompt-topic" maxLength={PRACTICE_LIMITS.topic} placeholder="Work, travel…" value={content.topic} onChange={(event) => set('topic')(event.target.value)} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>CEFR level</Label>
            <div className="flex flex-wrap gap-1.5">
              {CEFR_LEVELS.map((level) => (
                <Choice key={level} value={level} current={content.level} onPick={set('level')}>
                  {level}
                </Choice>
              ))}
            </div>
          </div>
        </div>

        {kind === PracticePromptKind.READ_ALOUD ? (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            <Field id="prompt-text" label="Text to read" hint={`${content.text.length}/${PRACTICE_LIMITS.readAloudText}`}>
              <Textarea id="prompt-text" rows={4} maxLength={PRACTICE_LIMITS.readAloudText} value={content.text} onChange={(event) => set('text')(event.target.value)} />
            </Field>
            <MediaInput
              id="prompt-audio"
              label="Model audio (optional)"
              kind="audio"
              mediaId={content.audioMediaId}
              media={media}
              onChange={(id, asset) => {
                if (asset) setMedia((current) => ({ ...current, [id]: asset }));
                set('audioMediaId')(id);
              }}
            />
            {!content.audioMediaId ? (
              <Button type="button" variant="outline" className="gap-1.5" loading={busy === 'voice'} disabled={Boolean(busy) || !content.text.trim()} onClick={makeVoice}>
                <AudioLines className="h-4 w-4" />
                Make it with the machine voice
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            {kind === PracticePromptKind.WRITING ? (
              <div className="space-y-2">
                <Label>Task type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(WritingTaskType).map((type) => (
                    <Choice key={type} value={type} current={content.taskType} onPick={set('taskType')}>
                      {taskTypeLabels[type]}
                    </Choice>
                  ))}
                </div>
              </div>
            ) : null}
            <Field id="prompt-instructions" label="Instructions" hint={`${content.instructions.length}/${PRACTICE_LIMITS.instructions}`}>
              <Textarea id="prompt-instructions" rows={4} maxLength={PRACTICE_LIMITS.instructions} value={content.instructions} onChange={(event) => set('instructions')(event.target.value)} />
            </Field>
            <MediaInput
              id="prompt-image"
              label="Image (optional)"
              kind="image"
              mediaId={content.imageMediaId}
              media={media}
              onChange={(id, asset) => {
                if (asset) setMedia((current) => ({ ...current, [id]: asset }));
                set('imageMediaId')(id);
              }}
            />
            {kind === PracticePromptKind.WRITING ? (
              <div className="flex flex-wrap gap-4">
                <Field id="prompt-min" label="Fewest words">
                  <Input id="prompt-min" type="number" className="w-28" min={PRACTICE_LIMITS.words.min} max={PRACTICE_LIMITS.words.max} value={content.minWords} onChange={(event) => set('minWords')(Number(event.target.value) || 1)} />
                </Field>
                <Field id="prompt-max" label="Most words">
                  <Input id="prompt-max" type="number" className="w-28" min={PRACTICE_LIMITS.words.min} max={PRACTICE_LIMITS.words.max} value={content.maxWords} onChange={(event) => set('maxWords')(Number(event.target.value) || 1)} />
                </Field>
              </div>
            ) : (
              <Field id="prompt-seconds" label="Speaking time (seconds)">
                <Input
                  id="prompt-seconds"
                  type="number"
                  className="w-28"
                  min={PRACTICE_LIMITS.speakingSeconds.min}
                  max={PRACTICE_LIMITS.speakingSeconds.max}
                  value={content.maxSeconds}
                  onChange={(event) => set('maxSeconds')(Math.min(PRACTICE_LIMITS.speakingSeconds.max, Math.max(PRACTICE_LIMITS.speakingSeconds.min, Number(event.target.value) || 60)))}
                />
              </Field>
            )}
          </div>
        )}

        {kind !== PracticePromptKind.READ_ALOUD ? (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            <Field
              id="prompt-sample"
              label="Sample answer"
              hint={kind === PracticePromptKind.WRITING ? `${words} words (${content.minWords}–${content.maxWords})` : `${words} words`}
            >
              <Textarea id="prompt-sample" rows={6} maxLength={PRACTICE_LIMITS.sampleAnswer} value={content.sampleAnswer} onChange={(event) => set('sampleAnswer')(event.target.value)} />
            </Field>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>Key points (optional)</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {content.keyPoints.length}/{PRACTICE_LIMITS.keyPoints}
                </span>
              </div>
              {content.keyPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                  <Input
                    aria-label={`Key point ${index + 1}`}
                    maxLength={PRACTICE_LIMITS.keyPoint}
                    value={point}
                    onChange={(event) => set('keyPoints')(content.keyPoints.map((item, at) => (at === index ? event.target.value : item)))}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={`Remove key point ${index + 1}`} onClick={() => set('keyPoints')(content.keyPoints.filter((_, at) => at !== index))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full gap-1.5 border-dashed" disabled={content.keyPoints.length >= PRACTICE_LIMITS.keyPoints} onClick={() => set('keyPoints')([...content.keyPoints, ''])}>
                <Plus className="h-4 w-4" />
                Add a key point
              </Button>
            </div>
          </div>
        ) : null}
      </fieldset>

      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <PracticePromptView kind={kind} content={content} media={media} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !busy && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prompt?</AlertDialogTitle>
            <AlertDialogDescription>Its files are deleted too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(busy)}
              onClick={async (event) => {
                event.preventDefault();
                if (await run('delete', () => deletePracticePrompt(promptId), 'Prompt deleted')) navigate('/teacher/prompts', { replace: true });
              }}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete prompt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

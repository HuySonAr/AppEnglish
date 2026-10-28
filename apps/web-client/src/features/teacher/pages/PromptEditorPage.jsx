import { useEffect, useState } from 'react';
import { AudioLines, Eye, Plus, Send, Trash2, Undo2, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContentResponseCode, PRACTICE_LEVELS, PRACTICE_LIMITS, PracticePromptKind, PracticePromptStatus, VoiceSpeed } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { hasTable } from '../../../lib/passage.js';
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
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { PracticePromptView } from '../../../components/shared/PracticePromptView.jsx';
import {
  deletePracticePrompt,
  getPracticePrompt,
  savePracticePromptDraft,
  submitPracticePrompt,
  createPracticeMachineAudio,
  withdrawPracticePrompt,
} from '../../../lib/api/practice-prompts-api.js';
import { applyEtsTask, countWords, etsFields, etsTaskLabel, etsTaskOf, etsTasksOf, fieldLabel, kindFromSlug, kindLabels, levelLabel, levelScores, speakingPartOf, statusInfo, teacherListPath, teacherPromptPath } from '../../../lib/practice-prompts.js';
import { Choice, Field, MediaInput, QuestionRows, TaskTypePicker, VoiceSpeedPicker } from '../components/PromptEditorParts.jsx';
import { SentenceTimes, syncSentences } from '../components/SentenceTimes.jsx';
import { kindPages } from './TeacherPromptsPage.jsx';

const EDITABLE = new Set([PracticePromptStatus.DRAFT, PracticePromptStatus.RETURNED, PracticePromptStatus.PUBLISHED, PracticePromptStatus.ARCHIVED, PracticePromptStatus.UNPUBLISHED]);

export function PromptEditorPage() {
  const { promptId, kindSlug } = useParams();
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
  const [voiceSpeed, setVoiceSpeed] = useState(VoiceSpeed.NORMAL);

  function apply(result) {
    setData(result);
    const loaded = result.latest.content;
    setContent(result.prompt.kind === PracticePromptKind.READ_ALOUD ? { ...loaded, sentences: syncSentences(loaded.text, loaded.sentences, loaded.translations) } : loaded);
    setMedia(result.media || {});
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      const result = (await getPracticePrompt(promptId)).data;
      if (kindFromSlug(kindSlug) !== result.prompt.kind) return navigate(teacherPromptPath(result.prompt.kind, promptId), { replace: true });
      apply(result);
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

  const setText = (value) => {
    setContent((current) => ({ ...current, text: value, sentences: syncSentences(value, current.sentences, current.translations) }));
    setDirty(true);
  };

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
  const addMedia = (id, asset) => setMedia((current) => ({ ...current, [id]: asset }));
  const setQuestion = (index, patch) => {
    setContent((current) => ({ ...current, questions: current.questions.map((question, at) => (at === index ? { ...question, ...patch } : question)) }));
    setDirty(true);
  };
  const setKeyword = (index, value) => {
    setContent((current) => ({ ...current, keywords: current.keywords.map((word, at) => (at === index ? value : word)) }));
    setDirty(true);
  };
  const pickTask = (task) => {
    setContent((current) => applyEtsTask(kind, current, task));
    setDirty(true);
  };
  async function makeVoice(text, onMade, label = 'voice') {
    setBusy(label);
    try {
      const { media: made } = (await createPracticeMachineAudio(text, voiceSpeed)).data;
      addMedia(made.id, { kind: 'audio', fileName: made.fileName, url: made.url });
      onMade(made.id);
      notify({ title: 'Audio made' });
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
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to={kindFromSlug(kindSlug) ? teacherListPath(kindFromSlug(kindSlug)) : '/teacher'}>
          Back to prompts
        </Link>
      </div>
    );

  const kind = data.prompt.kind;
  const status = data.latest.status;
  const pending = status === PracticePromptStatus.PENDING_REVIEW;
  const editable = EDITABLE.has(status);
  const canSubmit = status === PracticePromptStatus.DRAFT || status === PracticePromptStatus.RETURNED || (dirty && editable);
  const neverPublished = !data.published && !data.prompt.everPublished;
  const words = countWords(content.sampleAnswer);
  const task = etsTaskOf(kind, content);
  const part = speakingPartOf({ kind, etsTask: task });
  const listPath = part ? `${teacherListPath(kind)}?part=${part.number}` : teacherListPath(kind);
  const fields = kind === PracticePromptKind.READ_ALOUD ? null : task ? etsFields(kind, task) : null;
  const show = (name) => (fields ? fields[name] : !['context', 'info', 'questions', 'keywords', 'email'].includes(name));

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: kind === PracticePromptKind.WRITING ? kindPages[kind].title : 'Speaking prompts', to: listPath }, part ? { label: `Part ${part.number}`, to: listPath } : null, { label: content.title || 'Untitled prompt' }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{content.title || 'Untitled prompt'}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {etsTaskLabel(task, kindLabels[kind])} · {levelLabel(content.level)} · version {data.latest.versionNumber}
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
            <Label>Level</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRACTICE_LEVELS.map((level) => (
                <Choice key={level} value={level} current={content.level} onPick={set('level')}>
                  {levelLabel(level)} <span className="ml-1 font-normal opacity-75">{levelScores(level)}</span>
                </Choice>
              ))}
            </div>
          </div>
        </div>

        {kind === PracticePromptKind.READ_ALOUD ? (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            <TaskTypePicker tasks={etsTasksOf[kind]} current={task} fixed />
            <Field id="prompt-text" label="Text to read" hint={`${content.text.length}/${PRACTICE_LIMITS.readAloudText}`}>
              <Textarea id="prompt-text" rows={5} maxLength={PRACTICE_LIMITS.readAloudText} placeholder={'One sentence per line.\nAttention, passengers on the 10:15 train.'} value={content.text} onChange={(event) => setText(event.target.value)} />
            </Field>
            <p className="-mt-2 text-xs text-muted-foreground">Put each sentence on its own line; learners see one paragraph.</p>
            <MediaInput
              id="prompt-audio"
              label="Model audio (optional)"
              kind="audio"
              mediaId={content.audioMediaId}
              media={media}
              onChange={(id, asset) => {
                if (asset) addMedia(id, asset);
                set('audioMediaId')(id);
              }}
            />
            {!content.audioMediaId ? (
              <div className="space-y-3">
                <VoiceSpeedPicker speed={voiceSpeed} onPick={setVoiceSpeed} />
                <Button type="button" variant="outline" className="gap-1.5" loading={busy === 'voice'} disabled={Boolean(busy) || !content.text.trim()} onClick={() => makeVoice(content.text.trim(), set('audioMediaId'))}>
                  <AudioLines className="h-4 w-4" />
                  Make it with the machine voice
                </Button>
              </div>
            ) : null}
            <SentenceTimes
              promptId={promptId}
              sentences={content.sentences || []}
              audioUrl={content.audioMediaId ? media[content.audioMediaId]?.url || null : null}
              disabled={Boolean(busy) || pending}
              onChange={set('sentences')}
              beforeJob={async () => {
                const saved = (await savePracticePromptDraft(promptId, content)).data;
                if (saved?.prompt) apply(saved);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            <TaskTypePicker tasks={etsTasksOf[kind]} current={task} onPick={pickTask} fixed={Boolean(data.latest.content.etsTask)} />
            <Field id="prompt-instructions" label={fields && !fields.instructionsRequired ? 'Instructions (optional)' : 'Instructions'} hint={`${content.instructions.length}/${PRACTICE_LIMITS.instructions}`}>
              <Textarea id="prompt-instructions" rows={4} maxLength={PRACTICE_LIMITS.instructions} value={content.instructions} onChange={(event) => set('instructions')(event.target.value)} />
            </Field>
            {show('context') ? (
              <Field id="prompt-context" label="Context" hint={`${(content.context || '').length}/${PRACTICE_LIMITS.context}`}>
                <Textarea id="prompt-context" rows={3} maxLength={PRACTICE_LIMITS.context} placeholder="Imagine a friend is asking you about…" value={content.context || ''} onChange={(event) => set('context')(event.target.value)} />
              </Field>
            ) : null}
            {show('info') ? (
              <div className="space-y-2">
                <Field id="prompt-info" label="Information" hint={`${(content.info || '').length}/${PRACTICE_LIMITS.info}`}>
                  <Textarea id="prompt-info" rows={8} maxLength={PRACTICE_LIMITS.info} className="font-mono text-sm" placeholder="| Time | Event |" value={content.info || ''} onChange={(event) => set('info')(event.target.value)} />
                </Field>
                <p className="text-xs text-muted-foreground">Write table rows as | cell | cell |.</p>
                {hasTable(content.info) ? (
                  <div className="rounded-lg border bg-background p-3 text-sm">
                    <PassageText text={content.info} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {show('email') ? (
              <Field id="prompt-email" label="Email to reply to" hint={`${(content.email || '').length}/${PRACTICE_LIMITS.email}`}>
                <Textarea id="prompt-email" rows={8} maxLength={PRACTICE_LIMITS.email} value={content.email || ''} onChange={(event) => set('email')(event.target.value)} />
              </Field>
            ) : null}
            {show('image') ? (
              <MediaInput
                id="prompt-image"
                label={fields?.imageRequired ? 'Picture' : 'Image (optional)'}
                kind="image"
                mediaId={content.imageMediaId}
                media={media}
                onChange={(id, asset) => {
                  if (asset) addMedia(id, asset);
                  set('imageMediaId')(id);
                }}
              />
            ) : null}
            {show('keywords') ? (
              <div className="space-y-2">
                <Label>Words to use</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(content.keywords || []).map((word, index) => (
                    <Input key={index} aria-label={`Word ${index + 1}`} maxLength={PRACTICE_LIMITS.keyword} value={word} onChange={(event) => setKeyword(index, event.target.value)} />
                  ))}
                </div>
              </div>
            ) : null}
            {show('questions') ? <QuestionRows questions={content.questions || []} media={media} onMedia={addMedia} onQuestion={setQuestion} busy={busy} onVoice={makeVoice} voiceSpeed={voiceSpeed} onVoiceSpeed={setVoiceSpeed} /> : null}
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
              <Field id="prompt-seconds" label={task ? 'Speaking time without timer (seconds)' : 'Speaking time (seconds)'}>
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

        {kind !== PracticePromptKind.READ_ALOUD && (show('sampleAnswer') || show('keyPoints')) ? (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            {show('sampleAnswer') ? (
              <Field
                id="prompt-sample"
                label="Sample answer"
                hint={kind === PracticePromptKind.WRITING ? `${words} words (${content.minWords}–${content.maxWords})` : `${words} words`}
              >
                <Textarea id="prompt-sample" rows={6} maxLength={PRACTICE_LIMITS.sampleAnswer} value={content.sampleAnswer} onChange={(event) => set('sampleAnswer')(event.target.value)} />
              </Field>
            ) : null}
            {show('keyPoints') ? (
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
            ) : null}
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
                if (await run('delete', () => deletePracticePrompt(promptId), 'Prompt deleted')) navigate(listPath, { replace: true });
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

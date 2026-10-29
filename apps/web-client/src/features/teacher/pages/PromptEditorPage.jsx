import { useEffect, useState } from 'react';
import { Eye, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AutoTimeTarget, ContentResponseCode, EtsSpeakingTask, PRACTICE_LEVELS, PRACTICE_LIMITS, PracticePromptKind, PracticePromptStatus, SAMPLE_READING_TASKS, VoiceSpeed } from '@appenglish/content-contracts';
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
import { TableTool } from '../../../components/shared/TableTool.jsx';
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
import { AudioSlot, Choice, Field, KeyPointsGrid, MediaInput, QuestionRows, SampleReadingFields, TaskTypePicker, VoiceSpeedPicker } from '../components/PromptEditorParts.jsx';
import { SentenceTimes, syncSentences } from '../components/SentenceTimes.jsx';
import { useSpeechTasks } from '../../../hooks/use-speech-tasks.js';
import { kindPages } from './TeacherPromptsPage.jsx';

function withSentences(kind, content) {
  if (kind === PracticePromptKind.READ_ALOUD) return { ...content, sentences: syncSentences(content.text, content.sentences, content.translations) };
  if (kind !== PracticePromptKind.OPEN_SPEAKING || !SAMPLE_READING_TASKS.includes(content.etsTask)) return content;
  return {
    ...content,
    sampleSentences: syncSentences(content.sampleAnswer, content.sampleSentences),
    questions: (content.questions || []).map((question) => ({
      ...question,
      audioMediaId: content.etsTask === EtsSpeakingTask.RESPOND_QUESTIONS ? null : question.audioMediaId,
      sampleSentences: syncSentences(question.sampleAnswer, question.sampleSentences),
    })),
  };
}

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
  const voices = useSpeechTasks();

  function apply(result) {
    setData(result);
    const loaded = result.latest.content;
    setContent(withSentences(result.prompt.kind, loaded));
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

  const setSample = (value) => {
    setContent((current) => ({ ...current, sampleAnswer: value, sampleSentences: SAMPLE_READING_TASKS.includes(current.etsTask) ? syncSentences(value, current.sampleSentences) : current.sampleSentences }));
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
  function makeVoice(text, onMade, label = 'voice') {
    const speed = voiceSpeed;
    voices.start(label, async () => {
      try {
        const { media: made } = (await createPracticeMachineAudio(text, speed)).data;
        addMedia(made.id, { kind: 'audio', fileName: made.fileName, url: made.url });
        onMade(made.id);
        notify({ title: 'Audio made' });
      } catch (error) {
        notify({ title: 'Could not make the audio', description: getApiErrorMessage(error), variant: 'destructive' });
      }
    });
  }
  const saveFirst = async () => {
    const saved = (await savePracticePromptDraft(promptId, content)).data;
    if (saved?.prompt) apply(saved);
  };
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
  const show = (name) => (fields ? fields[name] : !['context', 'info', 'questions', 'keywords', 'email', 'sampleReading', 'imageWithSample'].includes(name));
  const speaking = kind !== PracticePromptKind.WRITING;

  const meta = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>
        {etsTaskLabel(task, kindLabels[kind])} · {levelLabel(content.level)} · v{data.latest.versionNumber}
      </span>
      <Badge variant={statusInfo[status].variant}>{statusInfo[status].label}</Badge>
      {data.published && data.published.id !== data.latest.id ? <Badge variant="success">Live v{data.published.versionNumber}</Badge> : null}
      {dirty ? (
        <Badge variant="info" className="hidden sm:inline-flex">
          Unsaved
        </Badge>
      ) : null}
    </div>
  );

  return (
    <section className="space-y-5">
      <PageBreadcrumb items={[{ label: kind === PracticePromptKind.WRITING ? kindPages[kind].title : 'Speaking prompts', to: listPath }, part ? { label: `Part ${part.number}`, to: listPath } : null, { label: content.title || 'Untitled prompt' }]} />

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-background px-4 py-2 sm:-mx-5 sm:flex-nowrap sm:gap-4 sm:px-5 sm:py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold sm:text-xl">
            {content.title || 'Untitled prompt'}
            {dirty ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-info align-middle sm:hidden" title="Unsaved" aria-label="Unsaved" /> : null}
          </h1>
          <div className="mt-0.5 hidden sm:block">{meta}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" className="h-9 gap-1.5 px-2.5 sm:px-4" aria-label="Preview" onClick={() => setPreviewing(true)}>
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          {pending ? (
            <Button variant="outline" className="h-9 gap-1.5 px-2.5 sm:px-4" aria-label="Take back" loading={busy === 'withdraw'} disabled={Boolean(busy) || voices.busy} onClick={() => run('withdraw', () => withdrawPracticePrompt(promptId), 'Taken back from review')}>
              <Undo2 className="h-4 w-4" />
              <span className="hidden sm:inline">Take back</span>
            </Button>
          ) : (
            <>
              <Button variant="outline" className="h-9 gap-1.5 px-2.5 sm:px-4" aria-label="Save draft" loading={busy === 'save'} disabled={Boolean(busy) || voices.busy || !dirty} title={voices.busy ? 'Wait for the machine voice' : undefined} onClick={save}>
                <Save className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Save draft</span>
              </Button>
              <Button className="h-9 gap-1.5 px-3 sm:px-4" loading={busy === 'submit'} disabled={Boolean(busy) || voices.busy || !canSubmit} title={voices.busy ? 'Wait for the machine voice' : undefined} onClick={submit}>
                <Send className="h-4 w-4" />
                <span className="sm:hidden">Send</span>
                <span className="hidden sm:inline">Send for review</span>
              </Button>
            </>
          )}
          {neverPublished && !pending ? (
            <Button variant="ghost" size="icon" aria-label="Delete prompt" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="basis-full sm:hidden">{meta}</div>
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

      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <div className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_14rem]">
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
            <div className="flex flex-wrap items-end justify-between gap-3">
              <TaskTypePicker tasks={etsTasksOf[kind]} current={task} fixed />
              <VoiceSpeedPicker speed={voiceSpeed} onPick={setVoiceSpeed} />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="flex flex-col gap-1.5">
                <Field id="prompt-text" label="Text to read" hint={`${content.text.length}/${PRACTICE_LIMITS.readAloudText}`} className="flex flex-1 flex-col">
                  <Textarea id="prompt-text" rows={5} className="min-h-[7rem] flex-1 resize-none" maxLength={PRACTICE_LIMITS.readAloudText} placeholder={'One sentence per line.\nAttention, passengers on the 10:15 train.'} value={content.text} onChange={(event) => setText(event.target.value)} />
                </Field>
                <p className="text-xs text-muted-foreground">Put each sentence on its own line; learners see one paragraph.</p>
              </div>
              <AudioSlot stretch preview={false} id="prompt-audio" label="Model audio (optional)" mediaId={content.audioMediaId} media={media} onMedia={addMedia} onChange={set('audioMediaId')} voiceText={content.text} voices={voices} busyKey="voice" onVoice={makeVoice} />
            </div>
            <SentenceTimes
              promptId={promptId}
              target={{ target: AutoTimeTarget.TEXT }}
              sentences={content.sentences || []}
              audioUrl={content.audioMediaId ? media[content.audioMediaId]?.url || null : null}
              disabled={Boolean(busy) || pending}
              onChange={set('sentences')}
              beforeJob={saveFirst}
            />
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <TaskTypePicker tasks={etsTasksOf[kind]} current={task} onPick={pickTask} fixed={Boolean(data.latest.content.etsTask)} />
              {speaking ? <VoiceSpeedPicker speed={voiceSpeed} onPick={setVoiceSpeed} /> : null}
            </div>
            {show('instructions') || (show('image') && !show('imageWithSample')) ? (
              <div className={show('instructions') && show('image') && !show('imageWithSample') ? 'grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]' : 'space-y-4'}>
                {show('instructions') ? (
                  <Field id="prompt-instructions" label={fields && !fields.instructionsRequired ? 'Instructions (optional)' : 'Instructions'} hint={`${content.instructions.length}/${PRACTICE_LIMITS.instructions}`}>
                    <Textarea
                      id="prompt-instructions"
                      rows={4}
                      maxLength={PRACTICE_LIMITS.instructions}
                      value={content.instructions}
                      onChange={(event) => set('instructions')(event.target.value)}
                    />
                  </Field>
                ) : null}
                {show('image') && !show('imageWithSample') ? (
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
              </div>
            ) : null}
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
                <TableTool value={content.info || ''} maxLength={PRACTICE_LIMITS.info} disabled={pending} onChange={set('info')} />
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
            {show('keywords') ? (
              <div className="space-y-2">
                <Label>Words to use</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(content.keywords || []).map((word, index) => (
                    <Input key={index} aria-label={`Word ${index + 1}`} maxLength={PRACTICE_LIMITS.keyword} value={word} onChange={(event) => setKeyword(index, event.target.value)} />
                  ))}
                </div>
              </div>
            ) : null}
            {show('questions') ? (
              <QuestionRows
                questions={content.questions || []}
                media={media}
                onMedia={addMedia}
                onQuestion={setQuestion}
                voices={voices}
                onVoice={makeVoice}
                sampleReading={show('sampleReading')}
                questionAudio={show('questionAudio')}
                promptId={promptId}
                beforeJob={saveFirst}
                disabled={Boolean(busy) || pending}
              />
            ) : null}
            {kind === PracticePromptKind.WRITING ? (
              <div className="flex flex-wrap gap-4">
                <Field id="prompt-min" label="Fewest words">
                  <Input id="prompt-min" type="number" className="w-28" min={PRACTICE_LIMITS.words.min} max={PRACTICE_LIMITS.words.max} value={content.minWords} onChange={(event) => set('minWords')(Number(event.target.value) || 1)} />
                </Field>
                <Field id="prompt-max" label="Most words">
                  <Input id="prompt-max" type="number" className="w-28" min={PRACTICE_LIMITS.words.min} max={PRACTICE_LIMITS.words.max} value={content.maxWords} onChange={(event) => set('maxWords')(Number(event.target.value) || 1)} />
                </Field>
              </div>
            ) : task ? null : (
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

        {kind !== PracticePromptKind.READ_ALOUD && (show('sampleAnswer') || show('keyPoints')) ? (
          <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
            {show('sampleAnswer') && show('sampleReading') ? (
              <SampleReadingFields
                id="prompt-sample"
                hint={`${words} words`}
                rows={6}
                text={content.sampleAnswer}
                onText={setSample}
                audioMediaId={content.sampleAudioMediaId || null}
                onAudio={set('sampleAudioMediaId')}
                sentences={content.sampleSentences}
                onSentences={set('sampleSentences')}
                media={media}
                onMedia={addMedia}
                voices={voices}
                onVoice={makeVoice}
                promptId={promptId}
                target={{ target: AutoTimeTarget.SAMPLE }}
                beforeJob={saveFirst}
                disabled={Boolean(busy) || pending}
                extra={
                  show('imageWithSample') ? (
                    <MediaInput
                      fill
                      id="prompt-image"
                      label="Picture"
                      kind="image"
                      mediaId={content.imageMediaId}
                      media={media}
                      onChange={(id, asset) => {
                        if (asset) addMedia(id, asset);
                        set('imageMediaId')(id);
                      }}
                    />
                  ) : null
                }
              />
            ) : show('sampleAnswer') ? (
              <Field
                id="prompt-sample"
                label="Sample answer"
                hint={kind === PracticePromptKind.WRITING ? `${words} words (${content.minWords}–${content.maxWords})` : `${words} words`}
              >
                <Textarea id="prompt-sample" rows={6} maxLength={PRACTICE_LIMITS.sampleAnswer} value={content.sampleAnswer} onChange={(event) => setSample(event.target.value)} />
              </Field>
            ) : null}
            {show('keyPoints') ? <KeyPointsGrid points={content.keyPoints} onChange={set('keyPoints')} /> : null}
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

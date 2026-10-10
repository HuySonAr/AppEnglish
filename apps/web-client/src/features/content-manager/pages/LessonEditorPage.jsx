import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import {
  Accent,
  ContentResponseCode,
  FILL_IN_BLANK,
  LESSON_TEST_PARTS,
  MediaKind,
  MediaSection,
  PartOfSpeech,
  Skill,
} from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../hooks/use-toast.js';
import {
  autofillPronunciation,
  deleteMedia,
  getLesson,
  publishLesson,
  saveLessonDraft,
  updateLesson,
  uploadMedia,
} from '../api/content-api.js';
import {
  issueLabel,
  issueLocation,
  lessonState,
  newVocabulary,
  setIn,
  uploadPending,
  withCorrectOption,
  withFillInPassage,
  workingContent,
} from '../lib/lesson-draft.js';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
import { Textarea } from '../../../components/ui/textarea.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { [Skill.LISTENING]: 'Listening', [Skill.READING]: 'Reading' };
const audioAccept = '.mp3,.mp4,.m4a,audio/mpeg,audio/mp4,video/mp4,audio/x-m4a';
const imageAccept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

// "question 1" or "questions 10–15": a part's numbers in the 23-question test.
function questionRange(spec, prefix = spec.questionCount === 1 ? 'question ' : 'questions ') {
  const last = spec.firstQuestionNumber + spec.questionCount - 1;
  return `${prefix}${spec.firstQuestionNumber}${last > spec.firstQuestionNumber ? `–${last}` : ''}`;
}

const saveErrorMessage = (error) =>
  `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

// File control for one media reference. media = { choose(kind, file, path),
// clear(path, mediaId), fileNames, pending, stored } from the page. A chosen
// file is only previewed; it is uploaded when the lesson is saved. Stored
// files can be played or viewed again when they have a delivery URL.
function MediaField({ id, label, kind, path, mediaId, media }) {
  const chosen = media.pending[mediaId];
  const url = chosen?.url || media.stored[mediaId]?.url;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {mediaId ? (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">
              {chosen?.file.name || media.fileNames[mediaId] || media.stored[mediaId]?.fileName || `${kind === MediaKind.AUDIO ? 'Audio' : 'Image'} attached`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => media.clear(path, mediaId)}>Remove</Button>
          </div>
          {url && kind === MediaKind.AUDIO ? <audio controls src={url} className="w-full" /> : null}
          {url && kind === MediaKind.IMAGE ? <img src={url} alt="" className="max-h-48 rounded-md" /> : null}
          {chosen ? <p className="text-muted-foreground">Preview only — uploaded when you save.</p> : null}
        </div>
      ) : (
        <Input
          id={id}
          type="file"
          accept={kind === MediaKind.AUDIO ? audioAccept : imageAccept}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) media.choose(kind, file, path);
          }}
        />
      )}
    </div>
  );
}

function TextField({ id, label, value, onChange, multiline = false, ...props }) {
  const Field = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Field id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  );
}

// Audio always travels with its transcript.
function AudioWithTranscript({ id, label, path, item, edit, media, transcriptMax }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MediaField id={`${id}-audio`} label={`${label} audio (MP3, MP4 or M4A)`} kind={MediaKind.AUDIO} path={[...path, 'audioMediaId']} mediaId={item.audioMediaId} media={media} />
      <TextField id={`${id}-transcript`} label={`${label} transcript`} value={item.transcript} maxLength={transcriptMax} multiline={transcriptMax > 1000} onChange={(value) => edit([...path, 'transcript'], value)} />
    </div>
  );
}

function PartEditor({ spec, part, edit, media }) {
  const base = ['test', spec.key];
  // Parts 1 and 2: the part recording reads the options, so only letters show.
  const lettersOnly = !spec.option.text;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          Part {spec.number}: {spec.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {skillLabels[spec.skill]} · {questionRange(spec)} · options{' '}
          {optionLetters.slice(0, spec.optionCount).join(', ')}
          {lettersOnly ? ' (one recording for the whole part reads the questions and options; learners see only the letters)' : ''}
        </p>
      </div>

      {spec.group.audio || spec.group.passage ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {spec.group.audio ? (
              <AudioWithTranscript id={`${spec.key}-group`} label={spec.title} path={base} item={part} edit={edit} media={media} transcriptMax={10000} />
            ) : null}
            {spec.group.passage ? (
              <TextField
                id={`${spec.key}-passage`}
                label={spec.group.blanks ? `Passage with exactly ${spec.questionCount} blanks, typed as ${FILL_IN_BLANK}` : 'Document (letter, form, report, notice…)'}
                value={part.passage}
                maxLength={10000}
                multiline
                rows={8}
                onChange={(value) => edit([...base, 'passage'], value)}
              />
            ) : null}
            {spec.group.optionalImage ? (
              <MediaField id={`${spec.key}-image`} label="Document image (optional)" kind={MediaKind.IMAGE} path={[...base, 'imageMediaId']} mediaId={part.imageMediaId} media={media} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {part.questions.map((question, index) => {
        const path = [...base, 'questions', index];
        const id = `${spec.key}-q${index}`;
        return (
          <Card key={question.id}>
            <CardContent className="space-y-4 pt-6">
              <p className="font-medium">
                Question {spec.firstQuestionNumber + index}
                {spec.group.blanks ? ` (blank ${index + 1})` : ''}
              </p>
              {spec.question.image ? (
                <MediaField id={`${id}-image`} label="Photograph (JPEG, PNG or WebP)" kind={MediaKind.IMAGE} path={[...path, 'imageMediaId']} mediaId={question.imageMediaId} media={media} />
              ) : null}
              {spec.question.prompt ? (
                <TextField id={`${id}-prompt`} label="Question text" value={question.prompt} maxLength={1000} onChange={(value) => edit([...path, 'prompt'], value)} />
              ) : null}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Options — select the correct answer</legend>
                {question.options.map((option, optionIndex) => {
                  const letter = optionLetters[optionIndex];
                  const optionPath = [...path, 'options', optionIndex];
                  return (
                    <div key={option.id} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        aria-label={`Option ${letter} is correct`}
                        checked={option.isCorrect}
                        onChange={() => edit(path, withCorrectOption(question, option.id))}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="w-4 text-sm font-medium">{letter}</span>
                      {lettersOnly ? null : (
                        <Input className="flex-1" aria-label={`Option ${letter} text`} value={option.text} maxLength={300} onChange={(event) => edit([...optionPath, 'text'], event.target.value)} />
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <TextField id={`${id}-explanation`} label="Explanation of the answer" value={question.explanation} maxLength={2000} multiline onChange={(value) => edit([...path, 'explanation'], value)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function LessonEditorPage() {
  const { lessonId } = useParams();
  const { toast } = useToast();
  const [state, setState] = useState('loading');
  const [lesson, setLesson] = useState(null);
  const [status, setStatus] = useState(lessonState(null));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  // Files chosen but not uploaded yet, by temporary id: { kind, file, section, url }.
  const [pending, setPending] = useState({});
  // Files the saved lesson uses, by media id: { kind, fileName, url }.
  const [stored, setStored] = useState({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState('vocabulary');
  const [partTab, setPartTab] = useState(LESSON_TEST_PARTS[0].key);
  // File names of media uploaded in this session; the API only stores ids.
  const [fileNames, setFileNames] = useState({});
  // Id of the vocabulary item whose pronunciation is being looked up.
  const [filling, setFilling] = useState(null);

  function apply(data) {
    setLesson(data.lesson);
    setTitle(data.lesson.title);
    setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingContent(data));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getLesson(lessonId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      toast({
        title: 'Could not load the lesson',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  // Leaving with unsaved edits asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Edits apply to the latest content, so an upload that finishes while the
  // user keeps typing does not overwrite what they typed.
  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));

  const media = {
    fileNames,
    pending,
    stored,
    // A file that was never uploaded is just dropped. Removing a stored file
    // also deletes it unless a saved version still uses it; in that case the
    // server deletes it when the draft is saved.
    clear(path, mediaId) {
      edit(path, null);
      if (pending[mediaId]) forgetPending([mediaId]);
      else deleteMedia(mediaId).catch(() => {});
    },
    choose(kind, file, path) {
      const temporaryId = crypto.randomUUID();
      // Vocabulary files and test files are stored in separate folders.
      const section = path[0] === 'vocabulary' ? MediaSection.VOCABULARY : MediaSection.TEST;
      setPending((current) => ({ ...current, [temporaryId]: { kind, file, section, url: URL.createObjectURL(file) } }));
      edit(path, temporaryId);
    },
  };

  function forgetPending(ids) {
    setPending((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (next[id]) URL.revokeObjectURL(next[id].url);
        delete next[id];
      }
      return next;
    });
  }

  // Previews are released when the page is left.
  useEffect(
    () => () => Object.values(pendingRef.current).forEach((item) => URL.revokeObjectURL(item.url)),
    [],
  );

  // Fills the phonetic text and the audio slots that are still empty from the
  // free dictionary; anything it lacks stays for manual entry or upload.
  async function onAutofill(item) {
    const missing = [
      item.audioUkMediaId ? null : Accent.UK,
      item.audioUsMediaId ? null : Accent.US,
    ].filter(Boolean);
    setFilling(item.id);
    try {
      const { found, phonetic, audio } = (await autofillPronunciation(item.word.trim(), missing, lessonId)).data;
      const uploaded = Object.values(audio).filter(Boolean);
      setFileNames((names) => ({ ...names, ...Object.fromEntries(uploaded.map((asset) => [asset.id, asset.fileName])) }));
      update((current) => ({
        ...current,
        vocabulary: current.vocabulary.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                phonetic: entry.phonetic || phonetic,
                audioUkMediaId: entry.audioUkMediaId || audio[Accent.UK]?.id || null,
                audioUsMediaId: entry.audioUsMediaId || audio[Accent.US]?.id || null,
              }
            : entry,
        ),
      }));
      const lacking = [
        item.phonetic || phonetic ? null : 'phonetic',
        ...missing.map((accent) => (audio[accent] ? null : accent === Accent.UK ? 'British audio' : 'American audio')),
      ].filter(Boolean);
      toast(
        !found
          ? { title: `"${item.word.trim()}" is not in the dictionary`, description: 'Enter the phonetic and upload the audio yourself.', variant: 'destructive' }
          : lacking.length
            ? { title: 'Partly filled', description: `The dictionary has no ${lacking.join(', ')} for this word. Add it yourself.` }
            : { title: 'Pronunciation filled' },
      );
    } catch (error) {
      toast({ title: 'Auto-fill failed', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setFilling(null);
    }
  }

  function showIssue(path) {
    const location = issueLocation(path);
    setTab(location.tab);
    if (location.part) setPartTab(location.part);
  }

  // Saving first uploads the files chosen since the last save.
  async function saveDraft({ quiet = false } = {}) {
    const result = await uploadPending(content, pending, async ({ kind, file, section }) => {
      try {
        return (await uploadMedia({ kind, file, lessonId, section })).data.media;
      } catch (error) {
        // Several files may upload in one save; say which one failed.
        error.fileName = file.name;
        throw error;
      }
    });
    const done = Object.entries(result.uploaded);
    if (done.length) {
      setFileNames((names) => ({ ...names, ...Object.fromEntries(done.map(([, uploaded]) => [uploaded.id, uploaded.fileName])) }));
      setContent(result.content);
      forgetPending(done.map(([temporaryId]) => temporaryId));
    }
    if (result.error) throw result.error;
    const data = (await saveLessonDraft(lessonId, result.content)).data;
    apply(data);
    forgetPending(Object.keys(pending));
    if (!quiet) toast({ title: `Draft saved (version ${data.draft.versionNumber})` });
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveDraft();
      setIssues([]);
    } catch (error) {
      toast({ title: 'Could not save the draft', description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ quiet: true });
      const data = (await publishLesson(lessonId)).data;
      apply(data);
      setIssues([]);
      toast({ title: `Published version ${data.published.versionNumber}` });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        showIssue(found[0].path);
        toast({
          title: 'Lesson cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Could not publish the lesson', description: saveErrorMessage(error), variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRename() {
    setBusy(true);
    try {
      const data = (await updateLesson(lessonId, { title: title.trim() })).data;
      setLesson(data.lesson);
      setTitle(data.lesson.title);
      toast({ title: 'Lesson renamed' });
    } catch (error) {
      toast({ title: 'Could not rename the lesson', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <Skeleton className="h-96 w-full" />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={load}>Try again</Button>
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/content-manager/units">
          Back to units
        </Link>
      </div>
    );

  const words = [...new Set(content.vocabulary.map((item) => item.word.trim()).filter(Boolean))];
  const canPublish = dirty || status.hasDraft;

  return (
    <section className="space-y-6">
      <Link
        to="/content-manager/units"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Units and lessons
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {status.publishedVersion ? (
            <Badge variant="success">Published v{status.publishedVersion}</Badge>
          ) : (
            <Badge variant="outline">Not published</Badge>
          )}
          {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
          {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="Lesson title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className="text-lg font-semibold"
          />
          <Button
            variant="outline"
            disabled={busy || !title.trim() || title.trim() === lesson.title}
            onClick={onRename}
          >
            Rename
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <Button disabled={busy || !canPublish} onClick={onPublish}>
            Publish
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Learners keep the published version until you publish again.
          Publishing creates a new version; earlier versions are kept unchanged.
          Audio and images you choose are previewed here and uploaded when you save.
        </p>
      </div>

      {issues.length ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => showIssue(issue.path)}>
                  {issueLabel(issue.path)}
                </button>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="vocabulary">Vocabulary ({content.vocabulary.length})</TabsTrigger>
          <TabsTrigger value="fillIn">Fill-in ({content.fillIn.answers.length})</TabsTrigger>
          <TabsTrigger value="test">Lesson test</TabsTrigger>
        </TabsList>

        <TabsContent value="vocabulary" className="space-y-4">
          {content.vocabulary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vocabulary yet.</p>
          ) : null}
          {content.vocabulary.map((item, index) => {
            const path = ['vocabulary', index];
            return (
              <Card key={item.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="grid gap-3 md:grid-cols-[1fr_12rem_1fr_auto]">
                    <TextField id={`word-${item.id}`} label={`Word ${index + 1}`} value={item.word} maxLength={100} onChange={(value) => edit([...path, 'word'], value)} />
                    <div className="space-y-2">
                      <Label htmlFor={`pos-${item.id}`}>Part of speech</Label>
                      <Select value={item.partOfSpeech || undefined} onValueChange={(value) => edit([...path, 'partOfSpeech'], value)}>
                        <SelectTrigger id={`pos-${item.id}`}>
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(PartOfSpeech).map((value) => (
                            <SelectItem key={value} value={value}>{value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <TextField id={`phonetic-${item.id}`} label="Phonetic (IPA, optional)" value={item.phonetic} maxLength={100} placeholder="/ˈtɪkɪt/" onChange={(value) => edit([...path, 'phonetic'], value)} />
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove word ${index + 1}`}
                        onClick={() => update((current) => ({ ...current, vocabulary: current.vocabulary.filter((entry) => entry.id !== item.id) }))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <TextField id={`meaning-${item.id}`} label="Meaning (for this part of speech)" value={item.meaning} maxLength={300} onChange={(value) => edit([...path, 'meaning'], value)} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField id={`example-${item.id}`} label="Example sentence" value={item.example} maxLength={500} onChange={(value) => edit([...path, 'example'], value)} />
                    <TextField id={`example-meaning-${item.id}`} label="Example translation (optional)" value={item.exampleMeaning} maxLength={500} onChange={(value) => edit([...path, 'exampleMeaning'], value)} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <MediaField id={`uk-${item.id}`} label="Pronunciation — British (optional)" kind={MediaKind.AUDIO} path={[...path, 'audioUkMediaId']} mediaId={item.audioUkMediaId} media={media} />
                    <MediaField id={`us-${item.id}`} label="Pronunciation — American (optional)" kind={MediaKind.AUDIO} path={[...path, 'audioUsMediaId']} mediaId={item.audioUsMediaId} media={media} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!item.word.trim() || filling !== null || (item.phonetic && item.audioUkMediaId && item.audioUsMediaId)}
                      onClick={() => onAutofill(item)}
                    >
                      {filling === item.id ? 'Looking up…' : 'Auto-fill pronunciation'}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Fills the empty phonetic and audio fields from a free dictionary. Check them; replace anything wrong.
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => update((current) => ({ ...current, vocabulary: [...current.vocabulary, newVocabulary()] }))}
          >
            <Plus className="h-4 w-4" />
            Add word
          </Button>
        </TabsContent>

        <TabsContent value="fillIn" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Write one passage and type {FILL_IN_BLANK} for each blank. Learners
            fill the blanks with words from this lesson&apos;s vocabulary.
          </p>
          <TextField
            id="fill-in-passage"
            label="Passage"
            value={content.fillIn.passage}
            maxLength={5000}
            multiline
            rows={8}
            onChange={(value) => update((current) => ({ ...current, fillIn: withFillInPassage(current.fillIn, value) }))}
          />
          {content.fillIn.answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">The passage has no blanks yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {content.fillIn.answers.map((answer, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`blank-${index}`}>Blank {index + 1}</Label>
                  <Select value={words.includes(answer) ? answer : undefined} onValueChange={(value) => edit(['fillIn', 'answers', index], value)}>
                    <SelectTrigger id={`blank-${index}`}>
                      <SelectValue placeholder={words.length ? 'Choose a word' : 'Add vocabulary first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {words.map((word) => (
                        <SelectItem key={word} value={word}>{word}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The lesson test always has seven parts and 23 questions: Parts 1–4
            are Listening, Parts 5–7 are Reading. Every question needs its
            correct answer and an explanation; every audio needs a transcript.
          </p>
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
                <PartEditor spec={spec} part={content.test[spec.key]} edit={edit} media={media} />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </section>
  );
}

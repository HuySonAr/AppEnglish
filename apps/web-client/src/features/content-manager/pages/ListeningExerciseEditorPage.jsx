import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileClock, MoveHorizontal, Play, Plus, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ContentResponseCode, LISTENING_LEVELS, LISTENING_MAX_SEGMENTS, MediaKind, MediaSection, lyricBlankCount } from '@appenglish/content-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
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
} from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { EditorPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import {
  getListeningExercise,
  publishListeningExercise,
  saveListeningExerciseDraft,
  updateListeningExercise,
} from '../api/content-api.js';
import { MediaField } from '../components/MediaField.jsx';
import { PasteDialog } from '../components/PasteDialog.jsx';
import { useDraftMedia } from '../hooks/use-draft-media.js';
import { lessonState, setIn } from '../lib/lesson-draft.js';
import {
  formatSeconds,
  listeningIssueLabel,
  listeningKindOf,
  listeningPastePlan,
  newSegment,
  parseSeconds,
  segmentLabel,
  withEnd,
  workingListening,
} from '../lib/listening-draft.js';
import { shiftTimes, timedImportPlan } from '../lib/timed-import.js';
import { ExportTimedDialog } from '../components/ExportTimedDialog.jsx';

const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

const kindHelp = {
  part1: 'The four statements (A)–(D) about the photograph, as the recording reads them. Times are optional; with them, learners can replay one statement.',
  part2: 'The question and its three responses, as the recording reads them. Times are optional; with them, learners can replay one sentence.',
  part3: 'The conversation sentence by sentence, with the speaker if you like. Every sentence needs its start and end: learners replay and write down one sentence at a time.',
  part4: 'The talk sentence by sentence. Every sentence needs its start and end: learners replay and write down one sentence at a time.',
  song: 'The lyrics line by line, each with its start and end. Put a word in square brackets, as in “I [walked] home”, to make it a blank: learners either write every line or fill in the blanks.',
};
const pasteExample = {
  part1: '(A) A man is reading a newspaper.\n(B) A woman is typing.\n(C) They are walking.\n(D) The room is empty.',
  part2: 'Where is the meeting?\n(A) In room 3.\n(B) At noon.\n(C) Yes, it is.',
  part3: 'Man: Excuse me, where is gate 5?\nWoman: It is next to the café.',
  part4: 'Attention, passengers.\nThe train to Boston is delayed.',
  song: 'I [walked] across an [empty] land\nI knew the pathway like the back of my [hand]',
};

// A time in the recording, typed as m:ss.s; it is kept when the field is left.
function TimeInput({ id, label, value, onChange }) {
  const [text, setText] = useState(formatSeconds(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(formatSeconds(value));
    setInvalid(false);
  }, [value]);
  return (
    <Input
      id={id}
      aria-label={label}
      inputMode="decimal"
      placeholder="m:ss.s"
      value={text}
      className={cn('w-24 tabular-nums', invalid && 'border-destructive')}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const seconds = parseSeconds(text);
        if (Number.isNaN(seconds)) setInvalid(true);
        else onChange(seconds);
      }}
    />
  );
}

// Editor of one listening exercise (F05B-2, D85): its details, the recording,
// and the sentences learners write down with their place in the recording.
export function ListeningExerciseEditorPage() {
  const { exerciseId } = useParams();
  const [state, setState] = useState('loading');
  const [exercise, setExercise] = useState(null);
  const [details, setDetails] = useState({ title: '', level: 'B1' });
  const [status, setStatus] = useState(lessonState(null));
  const [content, setContent] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState([]);
  // Where the player is, to set the start and end of a sentence.
  const [now, setNow] = useState(0);
  // Seconds typed in "Shift all times", e.g. "1.2" or "-0.5".
  const [shift, setShift] = useState('');
  const audioRef = useRef(null);
  // The time the player stops at while one sentence is played.
  const stopAt = useRef(null);

  function update(change) {
    setContent((current) => change(current));
    setDirty(true);
  }
  const edit = (path, value) => update((current) => setIn(current, path, value));
  const draftMedia = useDraftMedia({ edit, sectionFor: () => MediaSection.LISTENING });
  const setSegments = (change) => update((current) => ({ ...current, segments: change(current.segments) }));

  function apply(data) {
    setExercise(data.exercise);
    setDetails({ title: data.exercise.title, level: data.exercise.level });
    draftMedia.setStored(data.media || {});
    setStatus(lessonState(data));
    setContent(workingListening(data, data.exercise.kind));
    setDirty(false);
  }

  async function load() {
    setState('loading');
    try {
      apply((await getListeningExercise(exerciseId)).data);
      setIssues([]);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [exerciseId]);

  // Leaving with unsaved edits asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const audioId = content?.audioMediaId;
  const audioUrl = audioId ? draftMedia.media.pending[audioId]?.url || draftMedia.media.stored[audioId]?.url : null;

  // Follows the player, and stops it at the end of a sentence being played.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => {
      setNow(audio.currentTime);
      if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
        audio.pause();
        stopAt.current = null;
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('seeked', onTime);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('seeked', onTime);
    };
  }, [audioUrl]);

  const playerTime = () => Math.round((audioRef.current?.currentTime ?? 0) * 10) / 10;
  // The recording's length once the player knows it, for the last line of an .lrc file.
  const recordingLength = () => {
    const duration = audioRef.current?.duration;
    return Number.isFinite(duration) ? duration : null;
  };

  function playSegment(segment) {
    const audio = audioRef.current;
    if (!audio) return;
    stopAt.current = segment.end;
    audio.currentTime = segment.start;
    audio.play().catch(() => {});
  }

  // Saving first uploads the recording chosen since the last save.
  async function saveDraft({ quiet = false } = {}) {
    const result = await draftMedia.uploadAll(content);
    if (result.uploadedAny) setContent(result.content);
    if (result.error) throw result.error;
    const data = (await saveListeningExerciseDraft(exerciseId, result.content)).data;
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
      notify({ title: 'Could not save the draft', description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    try {
      if (dirty) await saveDraft({ quiet: true });
      const data = (await publishListeningExercise(exerciseId)).data;
      apply(data);
      setIssues([]);
      notify({ title: `Published version ${data.published.versionNumber}` });
    } catch (error) {
      const found = error?.response?.data?.data?.issues;
      if (errorCode(error) === ContentResponseCode.CONTENT_NOT_PUBLISHABLE && found?.length) {
        setIssues(found);
        notify({
          title: 'The exercise cannot be published yet',
          description: `${found.length} item${found.length === 1 ? '' : 's'} to fix. The draft was saved.`,
          variant: 'destructive',
        });
      } else {
        notify({ title: 'Could not publish the exercise', description: saveErrorMessage(error), variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails(event) {
    event.preventDefault();
    setBusy(true);
    try {
      setExercise((await updateListeningExercise(exerciseId, { title: details.title.trim(), level: details.level })).data.exercise);
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
        <Link className="block text-sm text-primary underline-offset-4 hover:underline" to="/content-manager/listening">
          Back to listening exercises
        </Link>
      </div>
    );

  const kind = listeningKindOf(exercise.kind);
  const fixed = Boolean(kind.segmentCount);
  const detailsChanged = details.title.trim() !== exercise.title || details.level !== exercise.level;
  const { segments } = content;
  const song = kind.key === 'song';
  const blankCount = song ? segments.reduce((sum, segment) => sum + lyricBlankCount(segment.text), 0) : 0;
  const shiftSeconds = Number(shift.replace(',', '.'));
  const canExport = segments.some((segment) => segment.text.trim() && segment.start !== null && segment.end !== null && segment.end > segment.start);
  const canShift = shift.trim() !== '' && Number.isFinite(shiftSeconds) && shiftSeconds !== 0 && segments.some((segment) => segment.start !== null || segment.end !== null);

  return (
    <section className="space-y-6">
      <Link to="/content-manager/listening" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Listening exercises
      </Link>

      <form onSubmit={onSaveDetails} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_7rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="listening-title">Title</Label>
          <Input id="listening-title" value={details.title} maxLength={200} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listening-level">Level</Label>
          <Select value={details.level} onValueChange={(level) => setDetails({ ...details, level })}>
            <SelectTrigger id="listening-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LISTENING_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" disabled={busy || !details.title.trim() || !detailsChanged}>
          Save details
        </Button>
      </form>

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {status.publishedVersion ? <Badge variant="success">Published v{status.publishedVersion}</Badge> : <Badge variant="outline">Not published</Badge>}
        {status.hasDraft ? <Badge variant="warning">Draft v{status.draftVersion}</Badge> : null}
        {dirty ? <Badge variant="info">Unsaved changes</Badge> : null}
        {exercise.topic ? <Badge variant="info">{exercise.topic.name}</Badge> : null}
        <Badge variant="secondary">{kind.number ? `Part ${kind.number}: ${kind.title}` : kind.title}</Badge>
        {song ? <Badge variant={blankCount ? 'secondary' : 'outline'}>{blankCount} blank{blankCount === 1 ? '' : 's'}</Badge> : null}
        <div className="ml-auto flex gap-2">
          <Button loading={busy} variant="outline" disabled={busy || !dirty} onClick={onSave}>
            {busy ? 'Working…' : 'Save draft'}
          </Button>
          <Button disabled={busy || !(dirty || status.hasDraft)} onClick={onPublish}>
            Publish
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {kindHelp[kind.key]} Title and level apply at once; the recording and sentences reach learners
        when you publish, and publishing again creates a new version.
      </p>

      {issues.length ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Fix these before publishing ({issues.length}):</p>
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
            {issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{listeningIssueLabel(issue.path, kind)}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <MediaField
            id="listening-audio"
            label="Recording (MP3, MP4 or M4A)"
            kind={MediaKind.AUDIO}
            path={['audioMediaId']}
            mediaId={content.audioMediaId}
            media={draftMedia.media}
            audioRef={audioRef}
          />
          {audioUrl ? (
            <p className="text-sm text-muted-foreground">
              Player at <span className="font-semibold tabular-nums text-foreground">{formatSeconds(now)}</span>. Pause where a
              sentence starts or ends, then use “Start here” or “End here” on that sentence. Setting an end also starts the
              next sentence there.
            </p>
          ) : content.audioMediaId ? (
            <p className="text-sm text-muted-foreground">This file cannot be played here, so times have to be typed.</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{song ? 'Lyrics' : 'Sentences to write down'}</h2>
          <Badge variant="secondary">{segments.length}</Badge>
          <div className="ml-auto flex flex-wrap gap-2">
            <PasteDialog
              id="paste-transcript"
              button="Paste transcript"
              title="Paste the transcript"
              description={
                fixed
                  ? `One sentence per line, in the order of the recording: ${kind.labels.join(', ')}. Letters such as (A) at the start are left out.`
                  : song
                    ? 'One line of the lyrics per line, in the order of the song. Put the words to fill in between square brackets. The lines replace the ones above and keep their times, position by position.'
                    : 'One sentence per line, in the order of the recording. "Man: …" at the start of a line becomes the speaker. The sentences replace the ones above and keep their times, position by position.'
              }
              label={song ? 'Lyrics' : 'Transcript'}
              placeholder={pasteExample[kind.key]}
              notFound="No sentence found."
              noun="sentence"
              done="written into the exercise"
              planFor={(text) => listeningPastePlan(segments, text, kind)}
              onApply={(plan) => setSegments(() => plan.segments)}
            />
            <PasteDialog
              id="import-timed"
              icon={FileClock}
              button="Import timed file"
              title="Import a timed file"
              description={`Subtitles (.srt, .vtt) or lyrics (.lrc) made for this recording. Each subtitle or lyric line becomes a ${song ? 'line' : 'sentence'} with its start and end, replacing the ones above. Sound notes such as [Music] are left out of subtitles; in .lrc lyrics, words in [brackets] after the time stay blanks.${fixed ? ` Part ${kind.number} needs exactly ${kind.segmentCount} sentences.` : ''}`}
              label="File content"
              placeholder={'1\n00:00:12,500 --> 00:00:16,900\nFirst line\n\nor\n\n[00:12.50]First line'}
              notFound="No timed line found. An .srt line has a time such as 00:00:12,500 --> 00:00:16,900, an .lrc line starts with [00:12.50]."
              noun={song ? 'line' : 'sentence'}
              done="imported with their times"
              fileAccept=".srt,.vtt,.lrc,.txt,text/plain"
              planFor={(text) => timedImportPlan(segments, text, kind, { duration: recordingLength() })}
              onApply={(plan) => setSegments(() => plan.segments)}
            />
            {/* The sentences as they are in the editor, saved or not (D90, D91). */}
            <ExportTimedDialog segments={segments} kind={kind} title={exercise.title} disabled={!canExport} />
            {fixed ? null : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={segments.length >= LISTENING_MAX_SEGMENTS}
                onClick={() => setSegments((current) => [...current, newSegment({ start: current.at(-1)?.end ?? null })])}
              >
                <Plus className="h-4 w-4" />
                {song ? 'Add line' : 'Add sentence'}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="shift-times" className="text-muted-foreground">
            Shift all times by
          </Label>
          <Input
            id="shift-times"
            inputMode="decimal"
            placeholder="e.g. 1.2 or -0.5"
            className="w-36"
            value={shift}
            onChange={(event) => setShift(event.target.value)}
          />
          <span className="text-muted-foreground">seconds</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!canShift}
            onClick={() => {
              setSegments((current) => shiftTimes(current, shiftSeconds));
              notify({ title: `Times moved ${shiftSeconds > 0 ? 'later' : 'earlier'} by ${Math.abs(shiftSeconds)} s` });
              setShift('');
            }}
          >
            <MoveHorizontal className="h-4 w-4" />
            Shift
          </Button>
          <span className="text-xs text-muted-foreground">Use it when a whole file is early or late against this recording.</span>
        </div>

        {segments.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sentence yet. Paste the transcript or add the sentences one by one.
          </p>
        ) : null}

        <ol className="space-y-3">
          {segments.map((segment, index) => {
            const path = ['segments', index];
            const id = `segment-${index}`;
            const timed = segment.start !== null && segment.end !== null && segment.end > segment.start;
            return (
              <li key={segment.id} id={id}>
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{segmentLabel(kind, index)}</span>
                      {kind.key === 'part3' ? (
                        <Input
                          aria-label={`${segmentLabel(kind, index)} speaker`}
                          placeholder="Speaker (optional)"
                          className="w-44"
                          maxLength={40}
                          value={segment.speaker}
                          onChange={(event) => edit([...path, 'speaker'], event.target.value)}
                        />
                      ) : null}
                      {fixed ? null : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto"
                          aria-label={`Remove ${segmentLabel(kind, index)}`}
                          onClick={() => setSegments((current) => current.filter((_, at) => at !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      aria-label={`${segmentLabel(kind, index)} text`}
                      rows={2}
                      maxLength={500}
                      value={segment.text}
                      onChange={(event) => edit([...path, 'text'], event.target.value)}
                    />
                    {song && lyricBlankCount(segment.text) ? (
                      <p className="text-xs text-muted-foreground">
                        {lyricBlankCount(segment.text)} blank{lyricBlankCount(segment.text) === 1 ? '' : 's'} in this line
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`${id}-start`} className="text-sm text-muted-foreground">
                        Start
                      </Label>
                      <TimeInput id={`${id}-start`} label={`${segmentLabel(kind, index)} start`} value={segment.start} onChange={(value) => edit([...path, 'start'], value)} />
                      <Button variant="outline" size="sm" disabled={!audioUrl} onClick={() => edit([...path, 'start'], playerTime())}>
                        Start here
                      </Button>
                      <Label htmlFor={`${id}-end`} className="ml-2 text-sm text-muted-foreground">
                        End
                      </Label>
                      <TimeInput id={`${id}-end`} label={`${segmentLabel(kind, index)} end`} value={segment.end} onChange={(value) => edit([...path, 'end'], value)} />
                      <Button variant="outline" size="sm" disabled={!audioUrl} onClick={() => setSegments((current) => withEnd(current, index, playerTime()))}>
                        End here
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5" disabled={!audioUrl || !timed} onClick={() => playSegment(segment)}>
                        <Play className="h-4 w-4" />
                        Play
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

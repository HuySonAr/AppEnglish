import { useEffect, useRef, useState } from 'react';
import { AudioLines, FileClock, Loader2, MoveHorizontal, Play, Plus, Trash2, Wand2 } from 'lucide-react';
import { LISTENING_MAX_SEGMENTS, MediaKind, lyricBlankCount } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import {
  applyAutoTime,
  formatSeconds,
  listeningPastePlan,
  newSegment,
  parseSeconds,
  segmentLabel,
  transcribedSegments,
  withEnd,
} from '../lib/listening-draft.js';
import { shiftTimes, timedImportPlan } from '../lib/timed-import.js';
import { ExportTimedDialog } from './ExportTimedDialog.jsx';
import { MediaField } from './MediaField.jsx';
import { PasteDialog } from './PasteDialog.jsx';

const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;

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

// One recording and the sentences of its transcript with their place in it
// (D85): the upload, Paste transcript, Transcribe (D98), Auto-time (D97),
// timed files (D89–D91), shifting all times, and each sentence with its start
// and end. Used by a listening-library exercise and a Listening course topic
// (D147).
//   content      { audioMediaId, segments } of the draft being edited
//   edit(path, value), setSegments(change), draftMedia   from the page
//   jobs         { request(task) → job, get() → job | null } for this owner
//   beforeJob()  saves the draft so the job reads the recording and lines
//   segmentExtra(segment, index)   more fields under a sentence (course)
export function RecordingEditor({ ownerId, kind, content, title, edit, setSegments, draftMedia, jobs, beforeJob, heading, audioLabel, segmentExtra }) {
  // Where the player is, to set the start and end of a sentence.
  const [now, setNow] = useState(0);
  // Seconds typed in "Shift all times", e.g. "1.2" or "-0.5".
  const [shift, setShift] = useState('');
  // The latest speech job and the lines its answer asks to check.
  const [job, setJob] = useState(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [checkIds, setCheckIds] = useState(() => new Set());
  const audioRef = useRef(null);
  // The time the player stops at while one sentence is played.
  const stopAt = useRef(null);

  // A job asked for earlier is picked up again.
  useEffect(() => {
    jobs
      .get()
      .then((found) => setJob(found))
      .catch(() => {});
  }, [ownerId]);

  // While a job waits or runs, its state is read every few seconds.
  const jobActive = job?.status === 'QUEUED' || job?.status === 'RUNNING';
  useEffect(() => {
    if (!jobActive) return undefined;
    const timer = setTimeout(async () => {
      try {
        setJob(await jobs.get());
      } catch {
        setJob((current) => ({ ...current }));
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [job, jobActive, ownerId]);

  const audioId = content.audioMediaId;
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

  // Saves the draft (the recording, and the lines speech-service times), then
  // sends the job: Auto-time (D97) or Transcribe (D98).
  async function startJob(task, failure) {
    setJobBusy(true);
    try {
      await beforeJob();
      setJob(await jobs.request(task));
    } catch (error) {
      notify({ title: failure, description: saveErrorMessage(error), variant: 'destructive' });
    } finally {
      setJobBusy(false);
    }
  }

  const { segments } = content;
  const fixed = Boolean(kind.segmentCount);
  const song = kind.key === 'song';
  const noun = song ? 'lines' : 'sentences';

  // The lines heard replace the ones there (D98).
  function applyTranscript() {
    setSegments(() => transcribedSegments(job.lines, kind));
    setCheckIds(new Set());
    setJob(null);
    notify({
      title: `${job.lines.length} ${noun} written from the recording`,
      description: `Correct the words${song ? ' and mark the [blanks]' : ''}, listen to a few with Play, then save the draft.`,
    });
  }

  function applyAutoTimeAnswer() {
    const { segments: timed, timed: count, check } = applyAutoTime(segments, job.lines);
    setSegments(() => timed);
    setCheckIds(new Set(check));
    setJob(null);
    notify({
      title: `Times set for ${count} of ${job.lineCount} ${noun}`,
      description: check.length ? `${check.length} marked “Check timing”: listen to them with Play.` : 'Listen to a few with Play, then save the draft.',
    });
  }

  const shiftSeconds = Number(shift.replace(',', '.'));
  const canExport = segments.some((segment) => segment.text.trim() && segment.start !== null && segment.end !== null && segment.end > segment.start);
  const canShift = shift.trim() !== '' && Number.isFinite(shiftSeconds) && shiftSeconds !== 0 && segments.some((segment) => segment.start !== null || segment.end !== null);
  const taskName = job?.task === 'transcribe' ? 'Transcribe' : 'Auto-time';

  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <MediaField
            id={`recording-${ownerId}`}
            label={audioLabel || 'Recording (MP3, MP4 or M4A)'}
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
          <h2 className="text-lg font-semibold">{heading || (song ? 'Lyrics' : 'Sentences to write down')}</h2>
          <Badge variant="secondary">{segments.length}</Badge>
          <div className="ml-auto flex flex-wrap gap-2">
            <PasteDialog
              id={`paste-transcript-${ownerId}`}
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
              done="written into the recording"
              planFor={(text) => listeningPastePlan(segments, text, kind)}
              onApply={(plan) => setSegments(() => plan.segments)}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={jobBusy || jobActive || !content.audioMediaId}
              onClick={() => startJob('transcribe', 'Could not start transcribe')}
            >
              <AudioLines className="h-4 w-4" />
              Transcribe
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              loading={jobBusy}
              disabled={jobBusy || jobActive || !content.audioMediaId || !segments.some((segment) => segment.text.trim())}
              onClick={() => startJob('align', 'Could not start auto-time')}
            >
              <Wand2 className="h-4 w-4" />
              Auto-time
            </Button>
            <PasteDialog
              id={`import-timed-${ownerId}`}
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
            <ExportTimedDialog segments={segments} kind={kind} title={title} disabled={!canExport} />
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

        {job && job.status !== 'DONE' ? (
          <div
            role="status"
            className={cn('flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm', job.status === 'FAILED' ? 'border-destructive/40 bg-destructive/10' : 'bg-muted/40')}
          >
            {jobActive ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>
              {job.status === 'QUEUED' ? `${taskName} is waiting for the speech service…` : null}
              {job.status === 'RUNNING' ? 'The speech service is listening to the recording; this can take a few minutes. You can keep working.' : null}
              {job.status === 'FAILED' ? `${taskName} failed: ${job.error}` : null}
            </span>
            {job.status === 'FAILED' ? (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setJob(null)}>
                Dismiss
              </Button>
            ) : null}
          </div>
        ) : null}
        {job?.status === 'DONE' && job.task === 'transcribe' ? (
          <div role="status" className="space-y-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Transcribe heard {job.lines.length} {noun} ({new Date(job.updatedAt).toLocaleTimeString()}).
                {segments.some((segment) => segment.text.trim()) ? ' They replace the lines below.' : ''}
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" disabled={!job.lines.length} onClick={applyTranscript}>
                  Use these lines
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setJob(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
            <ol className="max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-6 text-muted-foreground">
              {job.lines.map((line, index) => (
                <li key={index}>
                  <span className="tabular-nums">{formatSeconds(line.start)}</span> {line.text}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {job?.status === 'DONE' && job.task !== 'transcribe' ? (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
            <span>
              Auto-time found the times of {job.lines.filter((line) => line.start !== null).length} of {job.lineCount} {noun} (
              {new Date(job.updatedAt).toLocaleTimeString()}).
            </span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={applyAutoTimeAnswer}>
                Apply times
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setJob(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor={`shift-times-${ownerId}`} className="text-muted-foreground">
            Shift all times by
          </Label>
          <Input
            id={`shift-times-${ownerId}`}
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
            No sentence yet. Paste the transcript, use Transcribe, or add the sentences one by one.
          </p>
        ) : null}

        <ol className="space-y-3">
          {segments.map((segment, index) => {
            const path = ['segments', index];
            const id = `segment-${index}`;
            const label = segmentLabel(kind, index);
            const timed = segment.start !== null && segment.end !== null && segment.end > segment.start;
            return (
              <li key={segment.id} id={id}>
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{label}</span>
                      {checkIds.has(segment.id) ? <Badge variant="warning">Check timing</Badge> : null}
                      {kind.key === 'part3' ? (
                        <Input
                          aria-label={`${label} speaker`}
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
                          aria-label={`Remove ${label}`}
                          onClick={() => setSegments((current) => current.filter((_, at) => at !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Textarea aria-label={`${label} text`} rows={2} maxLength={500} value={segment.text} onChange={(event) => edit([...path, 'text'], event.target.value)} />
                    {song && lyricBlankCount(segment.text) ? (
                      <p className="text-xs text-muted-foreground">
                        {lyricBlankCount(segment.text)} blank{lyricBlankCount(segment.text) === 1 ? '' : 's'} in this line
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`${id}-start`} className="text-sm text-muted-foreground">
                        Start
                      </Label>
                      <TimeInput id={`${id}-start`} label={`${label} start`} value={segment.start} onChange={(value) => edit([...path, 'start'], value)} />
                      <Button variant="outline" size="sm" disabled={!audioUrl} onClick={() => edit([...path, 'start'], playerTime())}>
                        Start here
                      </Button>
                      <Label htmlFor={`${id}-end`} className="ml-2 text-sm text-muted-foreground">
                        End
                      </Label>
                      <TimeInput id={`${id}-end`} label={`${label} end`} value={segment.end} onChange={(value) => edit([...path, 'end'], value)} />
                      <Button variant="outline" size="sm" disabled={!audioUrl} onClick={() => setSegments((current) => withEnd(current, index, playerTime()))}>
                        End here
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5" disabled={!audioUrl || !timed} onClick={() => playSegment(segment)}>
                        <Play className="h-4 w-4" />
                        Play
                      </Button>
                    </div>
                    {segmentExtra ? segmentExtra(segment, index) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

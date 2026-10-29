import { useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronDown, ChevronUp, FileClock, Loader2, MoveHorizontal, Play, Plus, Trash2, Wand2 } from 'lucide-react';
import { LISTENING_MAX_SEGMENTS, MediaKind, lyricBlankCount } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
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
import { useReadOnly } from './ReadOnly.jsx';

const saveErrorMessage = (error) => `${error?.fileName ? `${error.fileName}: ` : ''}${getApiErrorMessage(error)}`;
const toolButton = 'w-full justify-start gap-2';

const pasteExample = {
  part1: '(A) A man is reading a newspaper.\n(B) A woman is typing.\n(C) They are walking.\n(D) The room is empty.',
  part2: 'Where is the meeting?\n(A) In room 3.\n(B) At noon.\n(C) Yes, it is.',
  part3: 'Man: Excuse me, where is gate 5?\nWoman: It is next to the café.',
  part4: 'Attention, passengers.\nThe train to Boston is delayed.',
  conversation: 'Anna: Hi, Pete. How was your weekend?\nPete: Great, thanks. I went hiking.',
  talk: 'Scientists say the ocean is getting warmer.\nThey studied water temperatures for fifty years.',
  song: 'I [walked] across an [empty] land\nI knew the pathway like the back of my [hand]',
};

const TIME_STEP = 0.1;
const TIME_BIG_STEP = 1;
const nudged = (value, delta) => Math.max(0, Math.round(((value ?? 0) + delta) * 10) / 10);

function TimeInput({ id, label, value, onChange, readOnly }) {
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
      readOnly={readOnly}
      placeholder="m:ss.s"
      title={readOnly ? undefined : '↑ ↓ change by 0.1 s, Shift for 1 s'}
      value={text}
      className={cn('h-8 w-20 rounded-r-none px-2 text-sm tabular-nums', invalid && 'border-destructive')}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (readOnly || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        const typed = parseSeconds(text);
        const base = typed === null || Number.isNaN(typed) ? value : typed;
        const step = event.shiftKey ? TIME_BIG_STEP : TIME_STEP;
        onChange(nudged(base, event.key === 'ArrowUp' ? step : -step));
      }}
      onBlur={() => {
        const seconds = parseSeconds(text);
        if (Number.isNaN(seconds)) setInvalid(true);
        else onChange(seconds);
      }}
    />
  );
}

function TimeStepper({ label, value, onChange }) {
  const stepButton = 'flex h-4 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
  return (
    <div className="flex h-8 flex-col overflow-hidden border-y border-r border-input bg-background">
      <button type="button" className={cn(stepButton, 'border-b border-input')} aria-label={`${label} later by 0.1 s`} onClick={() => onChange(nudged(value, TIME_STEP))}>
        <ChevronUp className="h-3 w-3" />
      </button>
      <button type="button" className={stepButton} aria-label={`${label} earlier by 0.1 s`} disabled={!value} onClick={() => onChange(nudged(value, -TIME_STEP))}>
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TimeField({ id, label, name, value, onChange, onHere, canHere, readOnly }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="w-9 text-xs text-muted-foreground">
        {name}
      </Label>
      <div className="flex">
        <TimeInput id={id} label={label} value={value} onChange={onChange} readOnly={readOnly} />
        {readOnly ? null : <TimeStepper label={label} value={value} onChange={onChange} />}
        {readOnly ? null : (
          <Button variant="outline" size="sm" className="h-8 rounded-l-none border-l-0 px-2 text-xs" disabled={!canHere} onClick={onHere}>
            Here
          </Button>
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      {title ? <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p> : null}
      {children}
    </div>
  );
}

function ToolGroup({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

export function RecordingEditor({ ownerId, kind, content, title, edit, setSegments, draftMedia, jobs, beforeJob, heading, hint, audioLabel, segmentExtra, tools, aside }) {
  const readOnly = useReadOnly();
  const [now, setNow] = useState(0);
  const [shift, setShift] = useState('');
  const [job, setJob] = useState(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [checkIds, setCheckIds] = useState(() => new Set());
  const audioRef = useRef(null);
  const stopAt = useRef(null);

  useEffect(() => {
    if (readOnly) return;
    jobs
      .get()
      .then((found) => setJob(found))
      .catch(() => {});
  }, [ownerId, readOnly]);

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

  function applyTranscript() {
    setSegments(() => transcribedSegments(job.lines, kind));
    setCheckIds(new Set());
    setJob(null);
    notify({ title: `${job.lines.length} ${noun} written from the recording`, description: 'Check the words, then save the draft.' });
  }

  function applyAutoTimeAnswer() {
    const { segments: timed, timed: count, check } = applyAutoTime(segments, job.lines);
    setSegments(() => timed);
    setCheckIds(new Set(check));
    setJob(null);
    notify({
      title: `Times set for ${count} of ${job.lineCount} ${noun}`,
      description: check.length ? `Listen to the ${check.length} marked “Check timing”.` : 'Listen to a few, then save the draft.',
    });
  }

  function addSegment() {
    setSegments((current) => [...current, newSegment({ start: current.at(-1)?.end ?? null })]);
  }

  const shiftSeconds = Number(shift.replace(',', '.'));
  const canExport = segments.some((segment) => segment.text.trim() && segment.start !== null && segment.end !== null && segment.end > segment.start);
  const canShift = shift.trim() !== '' && Number.isFinite(shiftSeconds) && shiftSeconds !== 0 && segments.some((segment) => segment.start !== null || segment.end !== null);
  const taskName = job?.task === 'transcribe' ? 'Transcribe' : 'Auto-time';
  const timedCount = segments.filter((segment) => segment.start !== null && segment.end !== null && segment.end > segment.start).length;
  const blankCount = song ? segments.reduce((sum, segment) => sum + lyricBlankCount(segment.text), 0) : 0;
  const canAdd = !readOnly && !fixed && segments.length < LISTENING_MAX_SEGMENTS;

  const jobStatus =
    job && job.status !== 'DONE' ? (
      <div role="status" className={cn('space-y-2 rounded-lg border p-3 text-sm', job.status === 'FAILED' ? 'border-destructive/40 bg-destructive/10' : 'bg-muted/40')}>
        <p className="flex items-start gap-2">
          {jobActive ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : null}
          <span>
            {job.status === 'QUEUED' ? `${taskName} is waiting…` : null}
            {job.status === 'RUNNING' ? `${taskName} is listening; you can keep working.` : null}
            {job.status === 'FAILED' ? `${taskName} failed: ${job.error}` : null}
          </span>
        </p>
        {job.status === 'FAILED' ? (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setJob(null)}>
            Dismiss
          </Button>
        ) : null}
      </div>
    ) : job?.status === 'DONE' && job.task === 'transcribe' ? (
      <div role="status" className="space-y-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <p>
          Transcribe heard {job.lines.length} {noun}.
          {segments.some((segment) => segment.text.trim()) ? ' They replace the current ones.' : ''}
        </p>
        <ol className="max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-5 text-xs text-muted-foreground">
          {job.lines.map((line, index) => (
            <li key={index}>
              <span className="tabular-nums">{formatSeconds(line.start)}</span> {line.text}
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <Button size="sm" disabled={!job.lines.length} onClick={applyTranscript}>
            Use these lines
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setJob(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    ) : job?.status === 'DONE' ? (
      <div role="status" className="space-y-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <p>
          Auto-time found {job.lines.filter((line) => line.start !== null).length} of {job.lineCount} {noun}.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={applyAutoTimeAnswer}>
            Apply times
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setJob(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <aside className="space-y-4 lg:sticky lg:top-36 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pb-2">
        <Panel>
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
            <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Player at</span>
              <span className="font-mono text-lg font-semibold tabular-nums">{formatSeconds(now) || '0:00.0'}</span>
            </div>
          ) : content.audioMediaId ? (
            <p className="text-xs text-muted-foreground">This file cannot play here; type the times.</p>
          ) : null}
        </Panel>

        <Panel title="Tools">
          {readOnly ? null : jobStatus}
          {readOnly ? null : (
            <>
              <ToolGroup label="Text">
                <PasteDialog
                  id={`paste-transcript-${ownerId}`}
                  button="Paste transcript"
                  triggerClassName={toolButton}
                  title="Paste the transcript"
                  description={
                    fixed
                      ? `One sentence per line: ${kind.labels.join(', ')}.`
                      : song
                        ? 'One lyric line per line, blanks in [brackets].'
                        : 'One sentence per line; “Man: …” sets the speaker.'
                  }
                  label={song ? 'Lyrics' : 'Transcript'}
                  placeholder={pasteExample[kind.key]}
                  notFound="No sentence found."
                  noun="sentence"
                  done="written into the recording"
                  planFor={(text) => listeningPastePlan(segments, text, kind)}
                  onApply={(plan) => setSegments(() => plan.segments)}
                />
                <Button variant="outline" size="sm" className={toolButton} disabled={jobBusy || jobActive || !content.audioMediaId} onClick={() => startJob('transcribe', 'Could not start transcribe')}>
                  <AudioLines className="h-4 w-4" />
                  Transcribe from audio
                </Button>
                {tools}
              </ToolGroup>
    
              <ToolGroup label="Timing">
                <Button
                  variant="outline"
                  size="sm"
                  className={toolButton}
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
                  triggerClassName={toolButton}
                  title="Import a timed file"
                  description={fixed ? `An .srt, .vtt or .lrc file with ${kind.segmentCount} lines.` : 'An .srt, .vtt or .lrc file made for this recording.'}
                  label="File content"
                  placeholder={'1\n00:00:12,500 --> 00:00:16,900\nFirst line\n\nor\n\n[00:12.50]First line'}
                  notFound="No timed line found."
                  noun={song ? 'line' : 'sentence'}
                  done="imported with their times"
                  fileAccept=".srt,.vtt,.lrc,.txt,text/plain"
                  planFor={(text) => timedImportPlan(segments, text, kind, { duration: recordingLength() })}
                  onApply={(plan) => setSegments(() => plan.segments)}
                />
                <div className="flex gap-1.5">
                  <Input
                    id={`shift-times-${ownerId}`}
                    aria-label="Shift all times by seconds"
                    inputMode="decimal"
                    placeholder="± seconds"
                    className="h-9 min-w-0 flex-1"
                    value={shift}
                    onChange={(event) => setShift(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={!canShift}
                    onClick={() => {
                      setSegments((current) => shiftTimes(current, shiftSeconds));
                      notify({ title: `Times moved ${shiftSeconds > 0 ? 'later' : 'earlier'} by ${Math.abs(shiftSeconds)} s` });
                      setShift('');
                    }}
                  >
                    <MoveHorizontal className="h-4 w-4" />
                    Shift all
                  </Button>
                </div>
              </ToolGroup>
            </>
          )}

          <ToolGroup label="File">
            <ExportTimedDialog segments={segments} kind={kind} title={title} disabled={!canExport} triggerClassName={toolButton} />
          </ToolGroup>
        </Panel>

        {aside}
      </aside>

      <div className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{heading || (song ? 'Lyrics' : 'Sentences')}</h2>
          <Badge variant="secondary" className="tabular-nums">
            {timedCount}/{segments.length} timed
          </Badge>
          {song ? <Badge variant={blankCount ? 'secondary' : 'outline'}>{blankCount} blank{blankCount === 1 ? '' : 's'}</Badge> : null}
          {canAdd ? (
            <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={addSegment}>
              <Plus className="h-4 w-4" />
              {song ? 'Add line' : 'Add sentence'}
            </Button>
          ) : null}
        </div>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}

        {segments.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Paste the transcript or transcribe the recording.</p>
        ) : (
          <ol className="space-y-2">
            {segments.map((segment, index) => {
              const path = ['segments', index];
              const id = `segment-${index}`;
              const label = segmentLabel(kind, index);
              const timed = segment.start !== null && segment.end !== null && segment.end > segment.start;
              const playing = Boolean(audioUrl) && timed && now >= segment.start && now < segment.end;
              const check = checkIds.has(segment.id);
              return (
                <li
                  key={segment.id}
                  id={id}
                  className={cn('rounded-xl border bg-card p-3 shadow-sm transition-colors', playing && 'border-primary bg-primary/5', check && !playing && 'border-warning')}
                >
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        'mt-1 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                        playing ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                      title={label}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {kind.labels?.[index] ? <span className="text-sm font-medium">{label}</span> : null}
                        {check ? <Badge variant="warning">Check timing</Badge> : null}
                        {kind.speakers ? (
                          <Input
                            aria-label={`${label} speaker`}
                            placeholder="Speaker"
                            className="h-8 w-36 text-sm"
                            maxLength={40}
                            readOnly={readOnly}
                            value={segment.speaker}
                            onChange={(event) => edit([...path, 'speaker'], event.target.value)}
                          />
                        ) : null}
                        {song && lyricBlankCount(segment.text) ? (
                          <span className="text-xs text-muted-foreground">
                            {lyricBlankCount(segment.text)} blank{lyricBlankCount(segment.text) === 1 ? '' : 's'}
                          </span>
                        ) : null}
                        {fixed || readOnly ? null : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${label}`}
                            onClick={() => setSegments((current) => current.filter((_, at) => at !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <Textarea aria-label={`${label} text`} readOnly={readOnly} rows={2} maxLength={500} value={segment.text} onChange={(event) => edit([...path, 'text'], event.target.value)} />
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <TimeField
                          id={`${id}-start`}
                          label={`${label} start`}
                          name="Start"
                          value={segment.start}
                          onChange={(value) => edit([...path, 'start'], value)}
                          canHere={Boolean(audioUrl)}
                          readOnly={readOnly}
                          onHere={() => edit([...path, 'start'], playerTime())}
                        />
                        <TimeField
                          id={`${id}-end`}
                          label={`${label} end`}
                          name="End"
                          value={segment.end}
                          onChange={(value) => edit([...path, 'end'], value)}
                          canHere={Boolean(audioUrl)}
                          readOnly={readOnly}
                          onHere={() => setSegments((current) => withEnd(current, index, playerTime()))}
                        />
                        <Button variant={playing ? 'default' : 'ghost'} size="sm" className="h-8 gap-1.5" disabled={!audioUrl || !timed} onClick={() => playSegment(segment)}>
                          <Play className="h-4 w-4" />
                          Play
                        </Button>
                      </div>
                      {segmentExtra ? segmentExtra(segment, index) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {canAdd && segments.length ? (
          <Button variant="outline" className="w-full gap-1.5 border-dashed" onClick={addSegment}>
            <Plus className="h-4 w-4" />
            {song ? 'Add line' : 'Add sentence'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

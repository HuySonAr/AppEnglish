import { useState } from 'react';
import { AudioLines, Plus, Timer, X } from 'lucide-react';
import { AutoTimeTarget, PRACTICE_LIMITS, VoiceSpeed } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { etsTaskLabels, etsTimingParts } from '../../../lib/practice-prompts.js';
import { uploadPracticeMedia } from '../../../lib/api/practice-prompts-api.js';
import { Button, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';
import { FileRow } from '../../../components/shared/FileRow.jsx';
import { SentenceTimes, syncSentences } from './SentenceTimes.jsx';

export function Field({ id, label, hint, children, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-xs tabular-nums text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Choice({ value, current, onPick, children }) {
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

export function MediaInput({ id, label, kind, mediaId, media, onChange, fill = false, preview = true }) {
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
    <Field id={id} label={label} className={fill ? 'flex h-full flex-col space-y-0 gap-2' : undefined}>
      {mediaId ? (
        <FileRow
          name={asset?.fileName || 'File attached'}
          status="done"
          note="Uploaded"
          onRemove={() => onChange(null)}
          className={fill ? 'flex flex-1 flex-col' : undefined}
          bodyClassName={fill ? 'relative min-h-48 flex-1' : undefined}
        >
          {preview && asset?.url && kind === 'audio' ? <audio controls src={asset.url} className="w-full" /> : null}
          {asset?.url && kind === 'image' ? <img src={asset.url} alt="" className={fill ? 'absolute inset-0 h-full w-full rounded-md bg-muted/30 object-contain' : 'max-h-48 rounded-md'} /> : null}
        </FileRow>
      ) : (
        <FileDropzone
          id={id}
          compact
          className={fill ? 'min-h-48 flex-1' : undefined}
          disabled={uploading}
          accept={kind === 'audio' ? '.mp3,.m4a,.mp4,audio/mpeg,audio/mp4' : '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'}
          kindLabel={uploading ? 'Uploading…' : kind === 'audio' ? 'MP3, MP4 or M4A' : 'JPEG, PNG or WebP'}
          onFile={choose}
        />
      )}
    </Field>
  );
}

export function EtsTiming({ task, className }) {
  const parts = etsTimingParts(task);
  if (!parts.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      {parts.map((part) => (
        <span key={part.label} className="rounded-md bg-muted px-2 py-1">
          {part.label} <span className="font-medium tabular-nums text-foreground">{part.value}</span>
        </span>
      ))}
    </div>
  );
}

export function TaskTypePicker({ tasks, current, onPick, fixed = false }) {
  return (
    <div className="space-y-2">
      <Label>Task type</Label>
      {!current && !fixed ? (
        <p role="status" className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          Choose a task type.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {(fixed ? tasks.filter((task) => !current || task === current) : tasks).map((task) =>
          fixed ? (
            <span key={task} className="inline-flex h-9 items-center rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground">
              {etsTaskLabels[task]}
            </span>
          ) : (
            <Choice key={task} value={task} current={current} onPick={onPick}>
              {etsTaskLabels[task]}
            </Choice>
          ),
        )}
      </div>
      <EtsTiming task={current} />
    </div>
  );
}

const VOICE_SPEED_LABELS = { [VoiceSpeed.SLOW]: 'Slow', [VoiceSpeed.NORMAL]: 'Normal', [VoiceSpeed.NATURAL]: 'Natural' };

export function VoiceSpeedPicker({ speed, onPick }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Machine voice speed</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Machine voice speed">
        {Object.values(VoiceSpeed).map((value) => (
          <Choice key={value} value={value} current={speed} onPick={onPick}>
            {VOICE_SPEED_LABELS[value]}
          </Choice>
        ))}
      </div>
    </div>
  );
}

export function AudioSlot({ id, label, mediaId, media, onMedia, onChange, voiceText = '', voices, busyKey, onVoice, preview = true, stretch = false }) {
  const making = voices?.isRunning(busyKey);
  const queued = voices?.isWaiting(busyKey);
  return (
    <div className={stretch ? 'flex h-full flex-col gap-2' : 'space-y-2'}>
      <MediaInput
        id={id}
        label={label}
        kind="audio"
        fill={stretch && !mediaId}
        preview={preview}
        mediaId={mediaId}
        media={media}
        onChange={(next, asset) => {
          if (asset) onMedia(next, asset);
          onChange(next);
        }}
      />
      {!mediaId && onVoice ? (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" loading={making} disabled={making || queued || !voiceText.trim()} onClick={() => onVoice(voiceText.trim(), onChange, busyKey)}>
          <AudioLines className="h-4 w-4" />
          {queued ? 'Waiting…' : making ? 'Making…' : 'Machine voice'}
        </Button>
      ) : null}
    </div>
  );
}

export function SampleReadingFields({
  id,
  label = 'Sample answer',
  hint,
  text,
  onText,
  audioMediaId,
  onAudio,
  sentences,
  onSentences,
  media,
  onMedia,
  voices,
  onVoice,
  promptId,
  target,
  beforeJob,
  disabled,
  rows = 4,
  extra = null,
}) {
  const sideBySide = !extra;
  const textField = (
    <Field id={`${id}-text`} label={label} hint={hint} className={sideBySide ? 'flex h-full flex-col' : undefined}>
      <Textarea
        id={`${id}-text`}
        rows={rows}
        maxLength={PRACTICE_LIMITS.sampleAnswer}
        placeholder="One sentence per line."
        className={sideBySide ? 'min-h-[5.5rem] flex-1 resize-none' : undefined}
        value={text}
        onChange={(event) => onText(event.target.value)}
      />
    </Field>
  );
  const audioSlot = (
    <AudioSlot stretch={sideBySide} preview={false} id={`${id}-audio`} label="Sample reading (optional)" mediaId={audioMediaId} media={media} onMedia={onMedia} onChange={onAudio} voiceText={text} voices={voices} busyKey={`voice-${id}`} onVoice={onVoice} />
  );
  return (
    <div className="space-y-3">
      {extra ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            {textField}
            {audioSlot}
          </div>
          {extra}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {textField}
          {audioSlot}
        </div>
      )}
      <SentenceTimes promptId={promptId} target={target} sentences={sentences || []} audioUrl={audioMediaId ? media[audioMediaId]?.url || null : null} disabled={disabled} onChange={onSentences} beforeJob={beforeJob} />
    </div>
  );
}

export function QuestionRows({ questions, media, onMedia, onQuestion: update, voices, onVoice, sampleReading = false, questionAudio = true, promptId, beforeJob, disabled }) {
  return (
    <div className="space-y-3">
      <Label>Questions</Label>
      {questions.map((question, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
            <span className="text-sm font-medium">Question {index + 1}</span>
          </div>
          <div className={cn('grid grid-cols-1 gap-3', questionAudio && 'lg:grid-cols-[minmax(0,1fr)_17rem]')}>
            <div className="flex flex-col gap-2">
              <Field id={`question-${index}-text`} label="Question" hint={`${question.text.length}/${PRACTICE_LIMITS.question}`} className={questionAudio ? 'flex flex-1 flex-col' : undefined}>
                <Textarea
                  id={`question-${index}-text`}
                  rows={2}
                  maxLength={PRACTICE_LIMITS.question}
                  className={questionAudio ? 'min-h-[4.5rem] flex-1 resize-none' : undefined}
                  value={question.text}
                  onChange={(event) => update(index, { text: event.target.value })}
                />
              </Field>
              <Input
                aria-label={`Translation of question ${index + 1}`}
                maxLength={PRACTICE_LIMITS.question}
                placeholder="Bản dịch tiếng Việt"
                className="h-9 text-sm"
                value={question.translation || ''}
                onChange={(event) => update(index, { translation: event.target.value })}
              />
            </div>
            {questionAudio ? (
              <AudioSlot
                stretch
                id={`question-${index}-audio`}
                label="Question audio (optional)"
                mediaId={question.audioMediaId}
                media={media}
                onMedia={onMedia}
                onChange={(id) => update(index, { audioMediaId: id })}
                voiceText={question.text}
                voices={voices}
                busyKey={`voice-${index}`}
                onVoice={onVoice}
              />
            ) : null}
          </div>
          {sampleReading ? (
            <SampleReadingFields
              id={`question-${index}-sample`}
              rows={3}
              text={question.sampleAnswer}
              onText={(value) =>
                update(index, {
                  sampleAnswer: value,
                  sampleSentences: syncSentences(value, question.sampleSentences),
                })
              }
              audioMediaId={question.sampleAudioMediaId || null}
              onAudio={(id) => update(index, { sampleAudioMediaId: id })}
              sentences={question.sampleSentences}
              onSentences={(value) => update(index, { sampleSentences: value })}
              media={media}
              onMedia={onMedia}
              voices={voices}
              onVoice={onVoice}
              promptId={promptId}
              target={{ target: AutoTimeTarget.QUESTION, index }}
              beforeJob={beforeJob}
              disabled={disabled}
            />
          ) : (
            <Field id={`question-${index}-sample`} label="Sample answer">
              <Textarea id={`question-${index}-sample`} rows={3} maxLength={PRACTICE_LIMITS.sampleAnswer} value={question.sampleAnswer} onChange={(event) => update(index, { sampleAnswer: event.target.value })} />
            </Field>
          )}
        </div>
      ))}
    </div>
  );
}

export function KeyPointsGrid({ points, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Key points (optional)</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {points.length}/{PRACTICE_LIMITS.keyPoints}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point, index) => (
          <div key={index} className="flex items-center gap-1 rounded-lg border bg-background py-1 pl-1.5 pr-0.5">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{index + 1}</span>
            <Input
              aria-label={`Key point ${index + 1}`}
              maxLength={PRACTICE_LIMITS.keyPoint}
              className="h-8 border-0 px-1.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              value={point}
              onChange={(event) => onChange(points.map((item, at) => (at === index ? event.target.value : item)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-label={`Remove key point ${index + 1}`}
              onClick={() => onChange(points.filter((_, at) => at !== index))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {points.length < PRACTICE_LIMITS.keyPoints ? (
          <Button type="button" variant="outline" className="h-auto min-h-10 gap-1.5 border-dashed text-muted-foreground" onClick={() => onChange([...points, ''])}>
            <Plus className="h-4 w-4" />
            Add a key point
          </Button>
        ) : null}
      </div>
    </div>
  );
}

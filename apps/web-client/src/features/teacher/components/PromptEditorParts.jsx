import { useState } from 'react';
import { AudioLines, Timer } from 'lucide-react';
import { PRACTICE_LIMITS } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { etsTaskLabels, etsTimingParts } from '../../../lib/practice-prompts.js';
import { uploadPracticeMedia } from '../../../lib/api/practice-prompts-api.js';
import { Button, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { FileDropzone } from '../../../components/shared/FileDropzone.jsx';
import { FileRow } from '../../../components/shared/FileRow.jsx';

export function Field({ id, label, hint, children }) {
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

export function MediaInput({ id, label, kind, mediaId, media, onChange }) {
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
        {tasks.map((task) =>
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

export function QuestionRows({ questions, media, onMedia, onQuestion: update, busy, onVoice }) {
  return (
    <div className="space-y-3">
      <Label>Questions</Label>
      {questions.map((question, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
            <span className="text-sm font-medium">Question {index + 1}</span>
          </div>
          <Field id={`question-${index}-text`} label="Question" hint={`${question.text.length}/${PRACTICE_LIMITS.question}`}>
            <Input id={`question-${index}-text`} maxLength={PRACTICE_LIMITS.question} value={question.text} onChange={(event) => update(index, { text: event.target.value })} />
          </Field>
          <Field id={`question-${index}-sample`} label="Sample answer">
            <Textarea id={`question-${index}-sample`} rows={3} maxLength={PRACTICE_LIMITS.sampleAnswer} value={question.sampleAnswer} onChange={(event) => update(index, { sampleAnswer: event.target.value })} />
          </Field>
          <MediaInput
            id={`question-${index}-audio`}
            label="Audio (optional)"
            kind="audio"
            mediaId={question.audioMediaId}
            media={media}
            onChange={(id, asset) => {
              if (asset) onMedia(id, asset);
              update(index, { audioMediaId: id });
            }}
          />
          {!question.audioMediaId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              loading={busy === `voice-${index}`}
              disabled={Boolean(busy) || !question.text.trim()}
              onClick={() => onVoice(question.text.trim(), (id) => update(index, { audioMediaId: id }), `voice-${index}`)}
            >
              <AudioLines className="h-4 w-4" />
              Machine voice
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

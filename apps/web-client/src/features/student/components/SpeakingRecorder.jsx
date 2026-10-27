import { Mic, RotateCcw, Send, Square } from 'lucide-react';
import { Button } from '../../../components/ui';
import { formatClock } from '../lib/practice.js';
import { canRecord, useRecorder } from '../hooks/use-recorder.js';

export function NoRecorder() {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">This browser cannot record audio. Try Chrome, Edge or Safari.</p>;
}

export function RecordingMeter({ elapsed, limit, onStop, label = 'Recording' }) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-destructive">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
        {label}
        <span className="tabular-nums text-muted-foreground">
          {formatClock(elapsed)} / {formatClock(limit)}
        </span>
      </div>
      <div className="mx-auto h-1.5 max-w-sm overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-destructive transition-[width] duration-200" style={{ width: `${Math.min(100, (elapsed / Math.max(limit, 1)) * 100)}%` }} />
      </div>
      <Button variant="destructive" className="gap-2" onClick={onStop}>
        <Square className="h-4 w-4" />
        Stop
      </Button>
    </div>
  );
}

export function SpeakingRecorder({ maxSeconds, submitting = false, onSubmit, submitLabel = 'Submit' }) {
  const recorder = useRecorder();

  if (!canRecord()) return <NoRecorder />;

  if (recorder.phase === 'recording') return <RecordingMeter elapsed={recorder.elapsed} limit={maxSeconds} onStop={recorder.stop} />;

  if (recorder.phase === 'recorded' && recorder.take)
    return (
      <div className="space-y-4">
        <audio controls src={recorder.take.url} className="w-full" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" className="gap-2" disabled={submitting} onClick={() => recorder.start(maxSeconds)}>
            <RotateCcw className="h-4 w-4" />
            Record again
          </Button>
          <Button className="gap-2" loading={submitting} onClick={() => onSubmit({ blob: recorder.take.blob, durationSeconds: recorder.take.durationSeconds })}>
            <Send className="h-4 w-4" />
            {submitLabel}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <button
        type="button"
        onClick={() => recorder.start(maxSeconds)}
        aria-label="Start recording"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Mic className="h-5 w-5" />
      </button>
      <p className="text-sm text-muted-foreground">Tap to record, up to {maxSeconds} seconds.</p>
    </div>
  );
}

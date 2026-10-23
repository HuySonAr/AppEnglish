import { useEffect, useRef, useState } from 'react';
import { Mic, RotateCcw, Send, Square } from 'lucide-react';
import { notify } from '../../../lib/notify.js';
import { Button } from '../../../components/ui';
import { formatClock, recordingType } from '../lib/practice.js';

const canRecord = () => typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== 'undefined';

export function SpeakingRecorder({ maxSeconds, submitting = false, onSubmit }) {
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const started = useRef(0);
  const url = useRef(null);

  function release() {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  function stop() {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function start() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      notify({ title: 'Microphone not available', description: 'Allow the microphone in your browser, then try again.', variant: 'destructive' });
      return;
    }
    const type = recordingType((candidate) => window.MediaRecorder.isTypeSupported(candidate));
    const chunks = [];
    const next = new window.MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    next.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    next.onstop = () => {
      const seconds = Math.min(maxSeconds, (performance.now() - started.current) / 1000);
      const blob = new Blob(chunks, { type: next.mimeType || type || 'audio/webm' });
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      setTake({ blob, url: url.current, seconds });
      setPhase('recorded');
      release();
    };
    recorder.current = next;
    next.start();
    started.current = performance.now();
    setElapsed(0);
    setTake(null);
    setPhase('recording');
    timer.current = setInterval(() => {
      const seconds = (performance.now() - started.current) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 200);
  }

  if (!canRecord())
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">This browser cannot record audio. Try Chrome, Edge or Safari.</p>;

  if (phase === 'recording')
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-destructive">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
          Recording
          <span className="tabular-nums text-muted-foreground">
            {formatClock(elapsed)} / {formatClock(maxSeconds)}
          </span>
        </div>
        <div className="mx-auto h-1.5 max-w-sm overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-destructive transition-[width] duration-200" style={{ width: `${Math.min(100, (elapsed / maxSeconds) * 100)}%` }} />
        </div>
        <Button variant="destructive" className="gap-2" onClick={stop}>
          <Square className="h-4 w-4" />
          Stop
        </Button>
      </div>
    );

  if (phase === 'recorded' && take)
    return (
      <div className="space-y-4">
        <audio controls src={take.url} className="w-full" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" className="gap-2" disabled={submitting} onClick={start}>
            <RotateCcw className="h-4 w-4" />
            Record again
          </Button>
          <Button className="gap-2" loading={submitting} onClick={() => onSubmit({ blob: take.blob, durationSeconds: Math.round(take.seconds * 10) / 10 })}>
            <Send className="h-4 w-4" />
            Submit
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <button
        type="button"
        onClick={start}
        aria-label="Start recording"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Mic className="h-7 w-7" />
      </button>
      <p className="text-sm text-muted-foreground">Tap to record, up to {maxSeconds} seconds.</p>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { notify } from '../../../lib/notify.js';
import { recordingType } from '../lib/practice.js';

export const canRecord = () => typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== 'undefined';

export function useRecorder({ onTake } = {}) {
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [take, setTake] = useState(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const started = useRef(0);
  const url = useRef(null);
  const handler = useRef(onTake);
  handler.current = onTake;

  function release() {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      release();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  async function openMic() {
    if (stream.current) return true;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      notify({ title: 'Microphone not available', description: 'Allow the microphone in your browser, then try again.', variant: 'destructive' });
      return false;
    }
  }

  function stop() {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  async function start(maxSeconds) {
    if (!(await openMic())) return false;
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
      const made = { blob, url: url.current, seconds, durationSeconds: Math.round(seconds * 10) / 10 };
      setTake(made);
      setPhase('recorded');
      release();
      handler.current?.(made);
    };
    recorder.current = next;
    next.start();
    started.current = performance.now();
    setElapsed(0);
    setLimit(maxSeconds);
    setTake(null);
    setPhase('recording');
    timer.current = setInterval(() => {
      const seconds = (performance.now() - started.current) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 200);
    return true;
  }

  function reset() {
    setTake(null);
    setPhase('idle');
    setElapsed(0);
  }

  return { phase, elapsed, limit, take, start, stop, reset, openMic };
}

export function useCountdown(seconds, running, onDone) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!running) {
      setLeft(seconds);
      return undefined;
    }
    const begin = performance.now();
    setLeft(seconds);
    let finished = false;
    const tick = setInterval(() => {
      const rest = Math.max(0, seconds - (performance.now() - begin) / 1000);
      setLeft(rest);
      if (rest <= 0 && !finished) {
        finished = true;
        clearInterval(tick);
        done.current?.();
      }
    }, 200);
    return () => clearInterval(tick);
  }, [seconds, running]);
  return left;
}

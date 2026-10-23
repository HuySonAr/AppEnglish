import { useEffect, useRef, useState } from 'react';

export function useHeldPlayer(audioRef, { line, speed = 1, active = true, onStop }) {
  const [started, setStarted] = useState(false);
  const stopAt = useRef(null);
  const frame = useRef(null);
  const lineRef = useRef(line);
  if (!lineRef.current || lineRef.current.id !== line?.id) lineRef.current = line;
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  const timed = (target) => target && target.start !== null && target.end !== null && target.end > target.start;

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, active]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function watch() {
    const audio = audioRef.current;
    if (!audio) return;
    if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
      stopAt.current = null;
      audio.pause();
      onStopRef.current?.();
      return;
    }
    frame.current = requestAnimationFrame(watch);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const outside = (target) => audio.currentTime < target.start - 0.05 || audio.currentTime >= target.end - 0.05;
    const onPlay = () => {
      const target = lineRef.current;
      audio.playbackRate = speed;
      setStarted(true);
      if (!timed(target)) return;
      if (outside(target)) audio.currentTime = target.start;
      stopAt.current = target.end;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(watch);
    };
    const onPause = () => cancelAnimationFrame(frame.current);
    const onSeeking = () => {
      const target = lineRef.current;
      if (timed(target) && outside(target) && Math.abs(audio.currentTime - target.end) > 0.05) audio.currentTime = target.start;
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeking', onSeeking);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeking', onSeeking);
    };
  }, [active, speed]);

  function playLine(target = lineRef.current) {
    const audio = audioRef.current;
    if (!audio || !target) return Promise.resolve();
    lineRef.current = target;
    if (timed(target)) audio.currentTime = target.start;
    return audio.play();
  }

  function reset(target = line) {
    cancelAnimationFrame(frame.current);
    stopAt.current = null;
    audioRef.current?.pause();
    lineRef.current = target;
    setStarted(false);
  }

  return { started, playLine, reset };
}

import { useEffect, useRef, useState } from 'react';

// The browser's own player held to one timed sentence or song line (D95):
// play starts at the line's start when it is outside the line or at its end,
// it stops at the line's end (checked on every frame so it never runs into
// the next line), and moving outside the line goes back to its start. A line
// without times ({ start: null }) leaves the player free.
//   audioRef  ref of the <audio controls> element
//   line      { id, start, end } the player is held to
//   speed     playback rate
//   active    false while the <audio> is not rendered; listeners are added
//             again when it comes back
//   onStop    called when the player stops at the line's end
// Returns { started, playLine(line?), reset(line?) }: started once play was
// pressed; playLine plays a line (by default the current one) from its start.
export function useHeldPlayer(audioRef, { line, speed = 1, active = true, onStop }) {
  const [started, setStarted] = useState(false);
  const stopAt = useRef(null);
  const frame = useRef(null);
  // The line the player is held to; set before a new line plays.
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

  // Plays the line (by default the current one) from its start. Rejects when
  // the browser refuses to play.
  function playLine(target = lineRef.current) {
    const audio = audioRef.current;
    if (!audio || !target) return Promise.resolve();
    lineRef.current = target;
    if (timed(target)) audio.currentTime = target.start;
    return audio.play();
  }

  // Stops and forgets that play was pressed; the player is held to `target`.
  function reset(target = line) {
    cancelAnimationFrame(frame.current);
    stopAt.current = null;
    audioRef.current?.pause();
    lineRef.current = target;
    setStarted(false);
  }

  return { started, playLine, reset };
}

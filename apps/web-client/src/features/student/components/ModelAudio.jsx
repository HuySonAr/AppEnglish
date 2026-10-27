import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import { formatClock } from '../lib/practice.js';
import { SpeedSwitch, useAudioState } from './RecordingPanel.jsx';

const PLAYER_HEIGHT = '4rem';

export function ModelAudio({ src, label = 'Model reading' }) {
  const audioRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const { time, duration, playing } = useAudioState(audioRef, src);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, src]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--player-h', PLAYER_HEIGHT);
    return () => root.style.removeProperty('--player-h');
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }

  function back() {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 3);
  }

  function seek(event) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    audio.currentTime = ((event.clientX - box.left) / box.width) * duration;
  }

  const percent = duration ? Math.min(100, (time / duration) * 100) : 0;
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card lg:left-64" role="region" aria-label={label}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" onLoadedMetadata={(event) => (event.currentTarget.playbackRate = speed)} />
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] sm:px-6">
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <Volume2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{label}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Back 3 seconds" onClick={back} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
          </div>
          <div className="flex w-full items-center gap-2">
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{formatClock(time)}</span>
            <div className="group relative flex h-3 min-w-0 flex-1 cursor-pointer items-center" onClick={seek} role="presentation">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary group-hover:bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <span className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-foreground opacity-0 transition-opacity group-hover:opacity-100" style={{ left: `${percent}%` }} aria-hidden="true" />
            </div>
            <span className="w-8 shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatClock(duration)}</span>
          </div>
        </div>
        <div className="flex justify-end">
          <SpeedSwitch speed={speed} onChange={setSpeed} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

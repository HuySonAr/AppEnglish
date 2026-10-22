import { useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play } from 'lucide-react';
import { COURSE_LIMITS } from '@appenglish/content-contracts';
import { Button } from '../../../components/ui';
import { playsLeft, readPlays, writePlays } from '../lib/test-plays.js';

const clock = (seconds) => {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};

// A recording in a unit check, level test or placement (D141): heard at its
// own speed, from the start, at most COURSE_LIMITS.testPlays times, without
// seeking, as in an exam. Pausing is allowed within a play. The plays used are
// kept for the browser session (playKey), so reloading the page does not give
// them back.
export function TestRecordingPlayer({ src, playKey }) {
  const audio = useRef(null);
  const [used, setUsed] = useState(() => readPlays(playKey));
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const limit = COURSE_LIMITS.testPlays;
  const left = playsLeft(used, limit);

  useEffect(() => () => audio.current?.pause(), []);

  function startPlay() {
    const element = audio.current;
    if (!element || left <= 0) return;
    const next = used + 1;
    setUsed(next);
    writePlays(playKey, next);
    element.playbackRate = 1;
    element.currentTime = 0;
    setStarted(true);
    element.play().catch(() => {});
  }

  function togglePause() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) element.play().catch(() => {});
    else element.pause();
  }

  const progress = time.total ? Math.min(100, (time.now / time.total) * 100) : 0;
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setStarted(false);
        }}
        onLoadedMetadata={(event) => setTime((current) => ({ ...current, total: event.currentTarget.duration }))}
        onTimeUpdate={(event) => setTime({ now: event.currentTarget.currentTime, total: event.currentTarget.duration })}
      />
      <div className="flex flex-wrap items-center gap-3">
        {started ? (
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={togglePause}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? 'Pause' : 'Resume'}
          </Button>
        ) : (
          <Button type="button" size="sm" className="gap-1.5" disabled={left <= 0} onClick={startPlay}>
            <Play className="h-4 w-4" />
            {used === 0 ? 'Play' : 'Play again'}
          </Button>
        )}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Headphones className="h-4 w-4" aria-hidden="true" />
          {left > 0 ? `${left} of ${limit} plays left` : 'No plays left'}
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {clock(time.now)} / {clock(time.total)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Position in the recording">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">As in the exam: normal speed, each play starts from the beginning.</p>
    </div>
  );
}

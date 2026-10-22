import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../../components/ui';

const SPEEDS = [0.75, 1, 1.25];

const clock = (seconds) => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

export function useAudioState(audioRef, audioUrl) {
  const [state, setState] = useState({ time: 0, duration: 0, playing: false });
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const update = () => setState({ time: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0, playing: !audio.paused });
    const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'play', 'pause', 'seeked', 'ended'];
    events.forEach((name) => audio.addEventListener(name, update));
    update();
    return () => events.forEach((name) => audio.removeEventListener(name, update));
  }, [audioUrl]);
  return state;
}

export function SpeedSwitch({ speed, onChange }) {
  return (
    <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label="Speed">
      {SPEEDS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={speed === value}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            speed === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value}×
        </button>
      ))}
    </div>
  );
}

export function RecordingPanel({ audioRef, audioUrl, held, follow = false, sentences, current, doneIds, showSentence, onSelect, onPlayLine, speed, onSpeed, className }) {
  const { time, duration, playing } = useAudioState(audioRef, audioUrl);
  const timed = sentences.filter((sentence) => sentence.start !== null && sentence.end !== null);
  const total = duration || timed.at(-1)?.end || 0;
  const sentence = sentences[current];

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else if (held && sentence) onPlayLine(sentence);
    else audio.play().catch(() => {});
  }

  function back() {
    const audio = audioRef.current;
    if (!audio) return;
    const floor = held && sentence?.start != null ? sentence.start : 0;
    audio.currentTime = Math.max(floor, audio.currentTime - 3);
  }

  function seek(event) {
    const audio = audioRef.current;
    if (!audio || !total || held) return;
    const box = event.currentTarget.getBoundingClientRect();
    audio.currentTime = ((event.clientX - box.left) / box.width) * total;
  }

  return (
    <aside className={cn('space-y-4 rounded-2xl border bg-card p-4 shadow-sm', className)}>
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" className="hidden" />
      {showSentence && sentence ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            Sentence {current + 1} of {sentences.length}
          </span>
          {sentence.speaker ? <span className="truncate text-xs text-muted-foreground">· {sentence.speaker}</span> : null}
        </div>
      ) : null}
      <div className="flex items-center justify-center gap-3">
        {showSentence ? (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Previous sentence" disabled={current === 0} onClick={() => onSelect(current - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : null}
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Back 3 seconds" onClick={back}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : held ? 'Play the sentence' : 'Play'}
          disabled={!audioUrl}
          onClick={toggle}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
        </button>
        <span className="w-12 text-xs tabular-nums text-muted-foreground">{clock(time)}</span>
        {showSentence ? (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Next sentence" disabled={current === sentences.length - 1} onClick={() => onSelect(current + 1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <div className={cn('relative h-2 overflow-hidden rounded-full bg-muted', !held && total && 'cursor-pointer')} onClick={seek} role="presentation">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary/70" style={{ width: `${total ? Math.min(100, (time / total) * 100) : 0}%` }} />
        </div>
        {total && timed.length ? (
          <div className="relative h-3" aria-label="Sentences">
            {sentences.map((item, index) =>
              item.start === null || item.end === null ? null : (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Sentence ${index + 1}`}
                  title={`Sentence ${index + 1}`}
                  onClick={() => onSelect(index, { play: true })}
                  className={cn(
                    'absolute inset-y-0 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    index === current && (held || follow) ? 'bg-primary' : doneIds.has(item.id) ? 'bg-success' : 'bg-muted-foreground/25 hover:bg-muted-foreground/45',
                  )}
                  style={{ left: `${(item.start / total) * 100}%`, width: `max(3px, calc(${((item.end - item.start) / total) * 100}% - 2px))` }}
                />
              ),
            )}
          </div>
        ) : null}
        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{doneIds.size ? `${doneIds.size} of ${sentences.length} sentences done` : `${sentences.length} sentences`}</span>
          <span>{clock(total)}</span>
        </div>
      </div>
      <div className="flex justify-center">
        <SpeedSwitch speed={speed} onChange={onSpeed} />
      </div>
    </aside>
  );
}

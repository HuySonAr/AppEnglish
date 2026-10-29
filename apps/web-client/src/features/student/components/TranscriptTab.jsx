import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Languages, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { cn } from '../../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { RowsSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getListeningTranscript } from '../api/practice-api.js';
import { activeSentence } from '../lib/listening-practice.js';
import { useAudioState } from './RecordingPanel.jsx';

const clock = (seconds) => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

const timed = (segment) => segment && segment.start !== null && segment.end !== null && segment.end > segment.start;

function Check({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </label>
  );
}

export function TranscriptTab({ exerciseId, audioRef, audioUrl, speed }) {
  const [state, setState] = useState('loading');
  const [segments, setSegments] = useState([]);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('vi');
  const [repeat, setRepeat] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState(0);
  const chosen = useRef(null);
  const listRef = useRef(null);
  const rows = useRef([]);
  const { time, duration, playing } = useAudioState(audioRef, audioUrl);
  const translated = language === 'vi';

  useEffect(() => {
    let current = true;
    getListeningTranscript(exerciseId)
      .then((reply) => {
        if (!current) return;
        setSegments(reply.data.segments);
        setState('ready');
      })
      .catch((failure) => {
        if (!current) return;
        setError(getApiErrorMessage(failure));
        setState('error');
      });
    return () => {
      current = false;
    };
  }, [exerciseId]);

  const active = activeSentence(segments, time);
  const sentence = segments[selected];

  useEffect(() => {
    if (chosen.current !== null) {
      if (active === chosen.current) chosen.current = null;
      return;
    }
    if (playing && active >= 0 && !repeat) setSelected(active);
  }, [active, playing, repeat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !repeat || !playing || !timed(sentence)) return;
    if (time >= sentence.end - 0.05) audio.currentTime = sentence.start;
  }, [time, repeat, sentence, playing]);

  useEffect(() => {
    const list = listRef.current;
    const row = rows.current[selected];
    if (!autoScroll || !list || !row) return;
    list.scrollTo({ top: row.offsetTop - list.clientHeight / 3, behavior: 'smooth' });
  }, [selected, autoScroll]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  function playFrom(index) {
    const audio = audioRef.current;
    const target = segments[index];
    if (!audio || !target) return;
    chosen.current = target.start !== null ? index : null;
    setSelected(index);
    if (target.start !== null) audio.currentTime = target.start;
    audio.play().catch(() => {});
  }

  function seek(event) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    chosen.current = null;
    audio.currentTime = ((event.clientX - box.left) / box.width) * duration;
  }

  const panel = 'rounded-b-2xl rounded-tr-2xl border border-t-0 bg-card p-4 shadow-xs sm:p-5';
  if (state === 'loading')
    return (
      <div className={panel}>
        <RowsSkeleton rows={4} />
      </div>
    );
  if (state === 'error') return <div className={cn(panel, 'text-sm text-destructive')}>The transcript could not be loaded. {error}</div>;
  if (!segments.length) return <div className={cn(panel, 'text-sm text-muted-foreground')}>This recording has no transcript.</div>;

  return (
    <div className={cn(panel, 'space-y-4')}>
      <div className="grid gap-3 lg:grid-cols-2 lg:items-center">
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-9 w-56" aria-label="Translation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vi">Vietnamese</SelectItem>
              <SelectItem value="none">No translation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Check id="transcript-repeat" checked={repeat} onChange={setRepeat}>
          Repeat
        </Check>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-1 flex-col rounded-xl border p-3">
            <div className="flex items-center gap-3 rounded-full bg-muted px-3 py-2">
              <button
                type="button"
                aria-label={playing ? 'Pause' : 'Play'}
                onClick={() => (playing ? audioRef.current?.pause() : playFrom(selected))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>
              <span className="shrink-0 text-sm tabular-nums">
                {clock(time)} / {clock(duration)}
              </span>
              <div className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-border" onClick={seek} role="presentation">
                <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/70" style={{ width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%` }} />
              </div>
              <button
                type="button"
                aria-label={muted ? 'Sound on' : 'Mute'}
                onClick={() => setMuted(!muted)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex min-h-56 flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
              <p className="text-2xl leading-snug sm:text-[1.7rem]">
                {sentence?.speaker ? <span className="mr-1 font-semibold">{sentence.speaker}:</span> : null}
                {sentence?.text}
              </p>
              {translated && sentence?.translation ? <p className="text-lg text-muted-foreground">{sentence.translation}</p> : null}
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 rounded-xl border py-2.5">
            <button type="button" aria-label="Previous sentence" disabled={selected === 0} onClick={() => playFrom(selected - 1)} className="rounded-full p-1.5 hover:bg-accent disabled:opacity-40">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="min-w-16 text-center text-lg tabular-nums">
              {selected + 1} / {segments.length}
            </span>
            <button type="button" aria-label="Next sentence" disabled={selected === segments.length - 1} onClick={() => playFrom(selected + 1)} className="rounded-full p-1.5 hover:bg-accent disabled:opacity-40">
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <ol ref={listRef} className="relative h-96 divide-y overflow-y-auto rounded-xl border lg:h-auto lg:max-h-120 lg:min-h-full">
            {segments.map((item, index) => (
              <li key={item.id} ref={(element) => (rows.current[index] = element)}>
                <button
                  type="button"
                  onClick={() => playFrom(index)}
                  className={cn('flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', index === selected && 'bg-accent')}
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2', index === selected ? 'border-primary text-primary' : 'border-muted-foreground/60 text-muted-foreground')}>
                    {index === selected && playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px]">
                      {item.speaker ? <span className="mr-1 font-semibold">{item.speaker}:</span> : null}
                      {item.text}
                    </span>
                    {translated && item.translation ? <span className="block text-sm text-muted-foreground">{item.translation}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex justify-end">
            <Check id="transcript-autoscroll" checked={autoScroll} onChange={setAutoScroll}>
              Auto scroll
            </Check>
          </div>
        </div>
      </div>
    </div>
  );
}

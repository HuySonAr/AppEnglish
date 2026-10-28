import { useEffect, useRef, useState } from 'react';
import { Languages, Pause, Play } from 'lucide-react';
import { readAloudSentences } from '@appenglish/content-contracts';
import { cn } from '../../../lib/utils.js';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { Button } from '../../../components/ui';
import { useAudioState } from './RecordingPanel.jsx';
import { useSentenceBounds } from '../hooks/use-wave-peaks.js';

const SPEEDS = [1, 0.75, 1.25];
const PAUSE_WEIGHT = 12;

export function readingSentences(prompt) {
  const own = (prompt.sentences || []).filter((sentence) => sentence.text);
  if (own.length) return own;
  return readAloudSentences(prompt.text).map((text, index) => ({ text, translation: prompt.translations?.[index] || '', start: null, end: null }));
}

const isTimed = (sentences) => sentences.length > 0 && sentences.every((sentence) => sentence.start !== null && sentence.end !== null);

export function sampleRange(sentences) {
  if (!isTimed(sentences)) return null;
  return { start: Math.min(...sentences.map((sentence) => sentence.start)), end: Math.max(...sentences.map((sentence) => sentence.end)) };
}

export function sentenceAt(sentences, time, duration, bounds = null) {
  if (!sentences.length) return -1;
  if (isTimed(sentences)) {
    let found = -1;
    sentences.forEach((sentence, index) => {
      if (time >= sentence.start - 0.05) found = index;
    });
    return found;
  }
  if (bounds?.length === sentences.length) return Math.max(0, bounds.findIndex((end) => time < end));
  if (!duration) return -1;
  const weights = sentences.map((sentence) => sentence.text.length + PAUSE_WEIGHT);
  const total = weights.reduce((sum, value) => sum + value, 0);
  let end = 0;
  for (let at = 0; at < weights.length; at += 1) {
    end += (weights[at] / total) * duration;
    if (time < end) return at;
  }
  return sentences.length - 1;
}

function ReadAloudText({ sentences, bilingual, active }) {
  if (bilingual)
    return (
      <ol className="space-y-2.5">
        {sentences.map((sentence, index) => (
          <li key={index} className={cn('rounded-lg px-2 py-1.5 transition-colors', index === active && 'bg-primary/10')}>
            <p className="text-base leading-relaxed sm:text-lg">{sentence.text}</p>
            {sentence.translation ? <p className="text-sm italic text-muted-foreground">{sentence.translation}</p> : null}
          </li>
        ))}
      </ol>
    );
  return (
    <p className="text-base leading-loose sm:text-lg sm:leading-loose">
      {sentences.map((sentence, index) => (
        <span key={index} className={cn('rounded px-0.5 transition-colors', index === active ? 'bg-primary/15' : '')}>
          {sentence.text}{' '}
        </span>
      ))}
    </p>
  );
}

export function SpeakingTaskCard({ prompt, part }) {
  const readAloud = prompt.kind === 'read_aloud';
  const audioRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [bilingual, setBilingual] = useState(false);
  const audio = useAudioState(audioRef, prompt.audioUrl);
  const sentences = readAloud ? readingSentences(prompt) : [];
  const bounds = useSentenceBounds(readAloud && !isTimed(sentences) ? prompt.audioUrl : null, sentences.length);
  const [clock, setClock] = useState(0);
  const range = sampleRange(sentences);
  const rangeEnd = range?.end ?? null;
  const active = audio.playing || clock > 0 ? sentenceAt(sentences, clock, audio.duration, bounds) : -1;

  useEffect(() => {
    if (!audio.playing) {
      setClock(audioRef.current?.currentTime || 0);
      return undefined;
    }
    let frame;
    const tick = () => {
      const element = audioRef.current;
      if (element && rangeEnd !== null && element.currentTime >= rangeEnd) {
        element.pause();
        element.currentTime = 0;
        setClock(0);
        return;
      }
      setClock(element?.currentTime || 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audio.playing, rangeEnd]);
  const hasTranslation = sentences.some((sentence) => sentence.translation);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  function toggle() {
    const element = audioRef.current;
    if (!element) return;
    if (audio.playing) element.pause();
    else {
      if (element.ended || element.currentTime >= (element.duration || 0) - 0.05) element.currentTime = 0;
      if (range && (element.currentTime < range.start || element.currentTime >= range.end - 0.05)) element.currentTime = range.start;
      element.playbackRate = speed;
      element.play().catch(() => {});
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-primary">
          Question {part?.firstQuestion || 1}: {part?.title || 'Task'}
        </p>
        {readAloud && prompt.audioUrl ? (
          <span className="flex items-center gap-1">
            <audio ref={audioRef} src={prompt.audioUrl} preload="metadata" className="hidden" onEnded={() => audioRef.current && (audioRef.current.currentTime = 0)} />
            <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-pressed={audio.playing} onClick={toggle}>
              {audio.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Read sample
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-11 px-0 text-xs tabular-nums" aria-label="Sample speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
              {speed}x
            </Button>
          </span>
        ) : null}
        {hasTranslation ? (
          <Button variant={bilingual ? 'default' : 'outline'} size="sm" className="h-8 gap-1.5" aria-pressed={bilingual} onClick={() => setBilingual(!bilingual)}>
            <Languages className="h-3.5 w-3.5" />
            Bilingual
          </Button>
        ) : null}
      </div>
      {prompt.title ? <p className="text-sm text-muted-foreground">{prompt.title}</p> : null}

      {readAloud ? (
        <ReadAloudText sentences={sentences} bilingual={bilingual} active={active} />
      ) : (
        <div className="space-y-3">
          {prompt.instructions ? <p className="whitespace-pre-line leading-relaxed sm:text-lg">{prompt.instructions}</p> : null}
          {prompt.context ? <p className="whitespace-pre-line leading-relaxed sm:text-lg">{prompt.context}</p> : null}
          {prompt.info ? (
            <div className="rounded-lg border bg-background p-3 text-sm">
              <PassageText text={prompt.info} />
            </div>
          ) : null}
          {prompt.imageUrl ? <img src={prompt.imageUrl} alt="" className="max-h-[50dvh] w-full rounded-lg border bg-background object-contain" /> : null}
        </div>
      )}
    </div>
  );
}

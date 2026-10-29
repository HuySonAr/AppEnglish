import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Languages, Pause, Play } from 'lucide-react';
import { EtsSpeakingTask, readAloudSentences } from '@appenglish/content-contracts';
import { cn } from '../../../lib/utils.js';
import { EASE_OUT } from '../../../lib/motion.js';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { Button } from '../../../components/ui';
import { useAudioState } from './RecordingPanel.jsx';
import { useSentenceBounds } from '../hooks/use-wave-peaks.js';

const SPEEDS = [1, 0.75, 1.25];
const PAUSE_WEIGHT = 12;

export function readingSentences(source) {
  const own = (source.sentences || []).filter((sentence) => sentence.text);
  if (own.length) return own;
  return readAloudSentences(source.text).map((text, index) => ({ text, translation: source.translations?.[index] || '', start: null, end: null }));
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

const swap = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22, ease: EASE_OUT } };

function ReadAloudText(props) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={props.bilingual ? 'bilingual' : 'plain'} {...swap}>
        <ReadAloudBody {...props} />
      </motion.div>
    </AnimatePresence>
  );
}

function ReadAloudBody({ sentences, bilingual, active, compact }) {
  const size = compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
  if (bilingual)
    return (
      <ol className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
        {sentences.map((sentence, index) => (
          <li key={index} className={cn('rounded-lg px-2 py-1.5 transition-colors duration-300 motion-reduce:transition-none', index === active && 'bg-primary/10')}>
            <p className={cn(size, 'leading-relaxed')}>{sentence.text}</p>
            {sentence.translation ? <p className={cn('italic text-muted-foreground', compact ? 'text-xs sm:text-sm' : 'text-sm')}>{sentence.translation}</p> : null}
          </li>
        ))}
      </ol>
    );
  return (
    <p className={cn(size, compact ? 'leading-relaxed' : 'leading-loose sm:leading-loose')}>
      {sentences.map((sentence, index) => (
        <span key={index} className={cn('rounded px-0.5 transition-colors duration-300 motion-reduce:transition-none', index === active ? 'bg-primary/15' : '')}>
          {sentence.text}{' '}
        </span>
      ))}
    </p>
  );
}

export function ReadingBlock({ heading, sentences, audioUrl, compact = false, children }) {
  const audioRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [bilingual, setBilingual] = useState(false);
  const audio = useAudioState(audioRef, audioUrl);
  const bounds = useSentenceBounds(audioUrl && !isTimed(sentences) ? audioUrl : null, sentences.length);
  const [clock, setClock] = useState(0);
  const range = sampleRange(sentences);
  const rangeEnd = range?.end ?? null;
  const active = audio.playing || clock > 0 ? sentenceAt(sentences, clock, audio.duration, bounds) : -1;
  const hasTranslation = sentences.some((sentence) => sentence.translation);

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

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const element = audioRef.current;
    return () => element?.pause();
  }, [audioUrl]);

  function toggle() {
    const element = audioRef.current;
    if (!element) return;
    if (audio.playing) return element.pause();
    if (element.ended || element.currentTime >= (element.duration || 0) - 0.05) element.currentTime = 0;
    if (range && (element.currentTime < range.start || element.currentTime >= range.end - 0.05)) element.currentTime = range.start;
    element.playbackRate = speed;
    document.querySelectorAll('audio[data-reading]').forEach((other) => other !== element && other.pause());
    element.play().catch(() => {});
  }

  const buttonSize = compact ? 'h-7 px-2.5 text-xs' : 'h-8';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-2">
        {heading ? <div className="min-w-[10rem] flex-1">{heading}</div> : null}
        {audioUrl ? (
          <span className="flex items-center gap-1">
            <audio ref={audioRef} data-reading="" src={audioUrl} preload="metadata" className="hidden" onEnded={() => audioRef.current && (audioRef.current.currentTime = 0)} />
            <Button variant="outline" size="sm" className={cn('gap-1.5', buttonSize)} aria-pressed={audio.playing} onClick={toggle}>
              {audio.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              Read sample
            </Button>
            <Button variant="ghost" size="sm" className={cn('w-11 px-0 text-xs tabular-nums', compact ? 'h-7' : 'h-8')} aria-label="Sample speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
              {speed}x
            </Button>
          </span>
        ) : null}
        {hasTranslation ? (
          <Button variant={bilingual ? 'default' : 'outline'} size="sm" className={cn('gap-1.5', buttonSize)} aria-pressed={bilingual} onClick={() => setBilingual(!bilingual)}>
            <Languages className="h-3.5 w-3.5" />
            Bilingual
          </Button>
        ) : null}
      </div>
      {children}
      <ReadAloudText sentences={sentences} bilingual={bilingual} active={active} compact={compact} />
    </div>
  );
}

function SampleBlock({ label, note, noteTranslation, sample }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/30">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-primary">{label}</span>
          {note ? <span className="mt-0.5 block text-sm font-medium">{note}</span> : null}
          {noteTranslation ? <span className="block text-xs italic text-muted-foreground">{noteTranslation}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-muted-foreground">
          {open ? 'Hide' : 'Show'}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="flex">
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="sample"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.35, ease: EASE_OUT }, opacity: { duration: 0.25 } }}
            className="overflow-hidden"
          >
            <div className="border-t px-3 pb-3 pt-2.5">
              <ReadingBlock compact sentences={readingSentences(sample)} audioUrl={sample.audioUrl} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function QuestionSamples({ items, first }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide sample answers' : `Sample answers (${items.length})`}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="flex">
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </Button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="samples"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.35, ease: EASE_OUT }, opacity: { duration: 0.25 } }}
            className="space-y-2 overflow-hidden"
          >
            {items.map(({ question, index }) => (
              <SampleBlock key={index} label={`Question ${first + index}`} note={question.text} noteTranslation={question.translation} sample={question.sample} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function SpeakingTaskCard({ prompt, part }) {
  const first = part?.firstQuestion || 1;
  const heading = (
    <p className="text-sm font-semibold text-primary">
      Question {first}: {part?.title || 'Task'}
    </p>
  );

  if (prompt.kind === 'read_aloud')
    return (
      <ReadingBlock heading={heading} sentences={readingSentences(prompt)} audioUrl={prompt.audioUrl} />
    );

  const questionSamples = (prompt.questions || []).map((question, index) => ({ question, index })).filter(({ question }) => question.sample);

  return (
    <div className="space-y-3">
      {heading}
      <div className="space-y-3">
        {prompt.instructions && prompt.etsTask !== EtsSpeakingTask.DESCRIBE_PICTURE ? <p className="whitespace-pre-line leading-relaxed sm:text-lg">{prompt.instructions}</p> : null}
        {prompt.context ? <p className="whitespace-pre-line leading-relaxed sm:text-lg">{prompt.context}</p> : null}
        {prompt.info ? (
          <div className="rounded-lg border bg-background p-3 text-sm">
            <PassageText text={prompt.info} />
          </div>
        ) : null}
        {prompt.imageUrl ? (
          <motion.img
            src={prompt.imageUrl}
            alt=""
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="max-h-[50dvh] w-full rounded-lg border bg-background object-contain"
          />
        ) : null}
      </div>
      {prompt.sample ? <SampleBlock label="Sample answer" sample={prompt.sample} /> : null}
      {questionSamples.length ? <QuestionSamples items={questionSamples} first={first} /> : null}
    </div>
  );
}

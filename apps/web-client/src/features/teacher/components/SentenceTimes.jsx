import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Wand2 } from 'lucide-react';
import { PRACTICE_LIMITS, readAloudSentences } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button, Input, Label } from '../../../components/ui';
import { getPracticeAutoTime, requestPracticeAutoTime } from '../../../lib/api/practice-prompts-api.js';

const POLL_MS = 2000;
const POLL_LIMIT = 90;
const newId = () => globalThis.crypto.randomUUID();

export function syncSentences(text, sentences = [], translations = []) {
  const unused = [...(sentences || [])];
  return readAloudSentences(text)
    .slice(0, PRACTICE_LIMITS.readAloudSentences)
    .map((sentence, index) => {
      const at = unused.findIndex((item) => item.text === sentence);
      if (at >= 0) return unused.splice(at, 1)[0];
      return { id: newId(), text: sentence, translation: (sentences || []).length ? '' : translations?.[index] || '', start: null, end: null };
    });
}

const seconds = (value) => (value === null || value === undefined ? '' : String(value));
const readSeconds = (value) => (value === '' ? null : Math.max(0, Math.round(Number(value) * 100) / 100));

export function SentenceTimes({ promptId, sentences, audioUrl, disabled, onChange, beforeJob }) {
  const audioRef = useRef(null);
  const stopAt = useRef(null);
  const [playing, setPlaying] = useState(null);
  const [timing, setTiming] = useState(false);
  const timed = sentences.filter((sentence) => sentence.start !== null && sentence.end !== null).length;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => {
      if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
        audio.pause();
        stopAt.current = null;
      }
    };
    const onPause = () => setPlaying(null);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioUrl]);

  const update = (id, patch) => onChange(sentences.map((sentence) => (sentence.id === id ? { ...sentence, ...patch } : sentence)));

  function preview(sentence) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing === sentence.id) return audio.pause();
    audio.currentTime = sentence.start ?? 0;
    stopAt.current = sentence.end;
    setPlaying(sentence.id);
    audio.play().catch(() => setPlaying(null));
  }

  async function autoTime() {
    setTiming(true);
    try {
      await beforeJob();
      let job = (await requestPracticeAutoTime(promptId)).data.job;
      for (let tries = 0; job && (job.status === 'QUEUED' || job.status === 'RUNNING') && tries < POLL_LIMIT; tries += 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        job = (await getPracticeAutoTime(promptId)).data.job;
      }
      if (job?.status !== 'DONE') throw new Error(job?.error || 'The speech service did not answer in time; try again.');
      const found = new Map(job.lines.map((line) => [line.id, line]));
      const next = sentences.map((sentence) => (found.has(sentence.id) ? { ...sentence, start: found.get(sentence.id).start, end: found.get(sentence.id).end } : sentence));
      const missed = next.filter((sentence) => sentence.start === null || sentence.end === null).length;
      onChange(next);
      notify(
        missed
          ? { title: `${missed} sentence${missed === 1 ? '' : 's'} not timed`, description: 'Type their start and end, then save the draft.', variant: 'destructive' }
          : { title: 'Sentences timed', description: 'Check the times, then save the draft.' },
      );
    } catch (error) {
      notify({ title: 'Could not time the sentences', description: error?.response ? error.response.data?.message || getApiErrorMessage(error) : error.message, variant: 'destructive' });
    } finally {
      setTiming(false);
    }
  }

  if (!sentences.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Sentences</Label>
          <p className="text-xs text-muted-foreground">
            {timed}/{sentences.length} timed · translation optional
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" loading={timing} disabled={disabled || timing || !audioUrl} title={audioUrl ? undefined : 'Add the model audio first'} onClick={autoTime}>
          <Wand2 className="h-4 w-4" />
          Auto-time
        </Button>
      </div>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" /> : null}
      <ol className="space-y-2">
        {sentences.map((sentence, index) => (
          <li key={sentence.id} className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}.</span>
              <p className="min-w-0 flex-1 text-sm">{sentence.text}</p>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Play sentence ${index + 1}`} disabled={!audioUrl || sentence.start === null} onClick={() => preview(sentence)}>
                {playing === sentence.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="grid gap-2 pl-7 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                aria-label={`Translation of sentence ${index + 1}`}
                maxLength={PRACTICE_LIMITS.readAloudTranslation}
                placeholder="Bản dịch tiếng Việt"
                className="h-8 text-sm"
                disabled={disabled}
                value={sentence.translation || ''}
                onChange={(event) => update(sentence.id, { translation: event.target.value })}
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {['start', 'end'].map((field) => (
                  <Input
                    key={field}
                    type="number"
                    step="0.1"
                    min="0"
                    aria-label={`${field === 'start' ? 'Start' : 'End'} of sentence ${index + 1} (seconds)`}
                    placeholder={field === 'start' ? 'Start' : 'End'}
                    className={cn('h-8 w-20 text-xs tabular-nums', sentence[field] === null && 'border-dashed')}
                    disabled={disabled}
                    value={seconds(sentence[field])}
                    onChange={(event) => update(sentence.id, { [field]: readSeconds(event.target.value) })}
                  />
                ))}
                <span>s</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

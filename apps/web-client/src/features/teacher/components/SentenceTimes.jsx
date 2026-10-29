import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Wand2 } from 'lucide-react';
import { PRACTICE_LIMITS, readAloudSentences } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { getPracticeAutoTime, requestPracticeAutoTime } from '../../../lib/api/practice-prompts-api.js';
import { TimeField } from '../../content-manager/components/RecordingEditor.jsx';
import { applyAutoTime, formatSeconds, withEnd } from '../../content-manager/lib/listening-draft.js';

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

const isTimed = (sentence) => sentence.start !== null && sentence.end !== null && sentence.end > sentence.start;

export function SentenceTimes({ promptId, target, sentences, audioUrl, disabled, onChange, beforeJob }) {
  const audioRef = useRef(null);
  const stopAt = useRef(null);
  const [now, setNow] = useState(0);
  const [timing, setTiming] = useState(false);
  const [job, setJob] = useState(null);
  const [checkIds, setCheckIds] = useState(() => new Set());
  const timed = sentences.filter(isTimed).length;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => {
      setNow(audio.currentTime);
      if (stopAt.current !== null && audio.currentTime >= stopAt.current) {
        audio.pause();
        stopAt.current = null;
      }
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('seeked', onTime);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('seeked', onTime);
    };
  }, [audioUrl]);

  const playerTime = () => Math.round((audioRef.current?.currentTime ?? 0) * 10) / 10;
  const update = (id, patch) => onChange(sentences.map((sentence) => (sentence.id === id ? { ...sentence, ...patch } : sentence)));

  function play(sentence) {
    const audio = audioRef.current;
    if (!audio) return;
    stopAt.current = sentence.end;
    audio.currentTime = sentence.start;
    audio.play().catch(() => {});
  }

  async function autoTime() {
    setTiming(true);
    setJob(null);
    try {
      await beforeJob();
      let found = (await requestPracticeAutoTime(promptId, target)).data.job;
      for (let tries = 0; found && (found.status === 'QUEUED' || found.status === 'RUNNING') && tries < POLL_LIMIT; tries += 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        found = (await getPracticeAutoTime(promptId)).data.job;
      }
      if (found?.status === 'DONE' || found?.status === 'FAILED') setJob(found);
      else throw new Error('The speech service did not answer in time; try again.');
    } catch (error) {
      notify({ title: 'Could not time the sentences', description: error?.response ? error.response.data?.message || getApiErrorMessage(error) : error.message, variant: 'destructive' });
    } finally {
      setTiming(false);
    }
  }

  function applyTimes() {
    const { segments: next, timed: count, check } = applyAutoTime(sentences, job.lines);
    onChange(next);
    setCheckIds(new Set(check));
    setJob(null);
    notify({ title: `Times set for ${count} of ${sentences.length} sentences`, description: check.length ? `Listen to the ${check.length} marked “Check timing”.` : 'Listen to a few, then save the draft.' });
  }

  if (!sentences.length && !audioUrl) return null;

  const found = job?.status === 'DONE' ? job.lines.filter((line) => line.start !== null).length : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Sentences</Label>
        <Badge variant="secondary" className="tabular-nums">
          {timed}/{sentences.length} timed
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          loading={timing}
          disabled={disabled || timing || !audioUrl || !sentences.length}
          title={audioUrl ? undefined : 'Add the audio first'}
          onClick={autoTime}
        >
          <Wand2 className="h-4 w-4" />
          Auto-time
        </Button>
      </div>

      {audioUrl ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="h-9 min-w-0 flex-1" />
          <span className="flex items-baseline gap-1.5 rounded-md bg-background px-2.5 py-1">
            <span className="text-xs text-muted-foreground">Player at</span>
            <span className="font-mono text-sm font-semibold tabular-nums">{formatSeconds(now) || '0:00.0'}</span>
          </span>
        </div>
      ) : null}

      {timing ? (
        <p role="status" className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Auto-time is listening…
        </p>
      ) : job?.status === 'FAILED' ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="min-w-0 flex-1">Auto-time failed: {job.error}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setJob(null)}>
            Dismiss
          </Button>
        </div>
      ) : job?.status === 'DONE' ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <span className="min-w-0 flex-1">
            Auto-time found {found} of {sentences.length} sentences.
          </span>
          <Button type="button" size="sm" className="h-8" onClick={applyTimes}>
            Apply times
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setJob(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <ol className="space-y-2">
        {sentences.map((sentence, index) => {
          const ready = isTimed(sentence);
          const playing = Boolean(audioUrl) && ready && now >= sentence.start && now < sentence.end;
          const check = checkIds.has(sentence.id);
          return (
            <li key={sentence.id} className={cn('space-y-2 rounded-lg border bg-background p-2.5 transition-colors', playing && 'border-primary bg-primary/5', check && !playing && 'border-warning')}>
              <div className="flex items-start gap-2">
                <span className={cn('flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums', playing ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{index + 1}</span>
                <p className="min-w-0 flex-1 pt-0.5 text-sm">{sentence.text}</p>
                {check ? <Badge variant="warning">Check timing</Badge> : null}
              </div>
              <div className="space-y-2 pl-8">
                <Input
                  aria-label={`Translation of sentence ${index + 1}`}
                  maxLength={PRACTICE_LIMITS.readAloudTranslation}
                  placeholder="Bản dịch tiếng Việt"
                  className="h-8 text-sm"
                  disabled={disabled}
                  value={sentence.translation || ''}
                  onChange={(event) => update(sentence.id, { translation: event.target.value })}
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <TimeField
                    id={`${promptId}-${sentence.id}-start`}
                    label={`Sentence ${index + 1} start`}
                    name="Start"
                    value={sentence.start}
                    onChange={(value) => update(sentence.id, { start: value })}
                    canHere={Boolean(audioUrl)}
                    readOnly={disabled}
                    onHere={() => update(sentence.id, { start: playerTime() })}
                  />
                  <TimeField
                    id={`${promptId}-${sentence.id}-end`}
                    label={`Sentence ${index + 1} end`}
                    name="End"
                    value={sentence.end}
                    onChange={(value) => update(sentence.id, { end: value })}
                    canHere={Boolean(audioUrl)}
                    readOnly={disabled}
                    onHere={() => onChange(withEnd(sentences, index, playerTime()))}
                  />
                  <Button type="button" variant={playing ? 'default' : 'ghost'} size="sm" className="h-8 gap-1.5" disabled={!audioUrl || !ready} onClick={() => play(sentence)}>
                    <Play className="h-4 w-4" />
                    Play
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

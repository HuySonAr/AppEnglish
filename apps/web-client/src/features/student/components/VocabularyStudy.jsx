import { useState } from 'react';
import { CheckCircle2, Volume2 } from 'lucide-react';
import { GB, US } from 'country-flag-icons/react/1x1';
import { playSound } from '../../../lib/audio.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { WordFlipCard } from './WordFlipCard.jsx';

const ACCENTS = {
  US: { Flag: US, name: 'American' },
  UK: { Flag: GB, name: 'British' },
};

export function Pronunciation({ label, url }) {
  const [playing, setPlaying] = useState(false);
  if (!url) return null;
  const { Flag, name } = ACCENTS[label] || ACCENTS.UK;

  function play() {
    setPlaying(true);
    playSound(url, { onEnd: () => setPlaying(false) }).catch(() => {
      setPlaying(false);
      notify({ title: 'Could not play the word', variant: 'destructive' });
    });
  }

  return (
    <button
      type="button"
      aria-label={`Play the ${name} pronunciation (${label})`}
      aria-pressed={playing}
      onClick={play}
      className="group inline-flex items-center gap-1.5 rounded-full border bg-card p-1 shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:gap-2 md:pl-1.5"
    >
      <span className="flex h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-border sm:h-5 sm:w-5">
        <Flag title="" className="h-full w-full" />
      </span>
      <span className="hidden text-sm font-semibold md:inline">{label}</span>
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:text-primary sm:h-6 sm:w-6', playing && 'bg-primary/10 text-primary')}>
        <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />
      </span>
    </button>
  );
}

export function VocabularyStudy({ vocabulary, done, busy, onAllOpened }) {
  const [opened, setOpened] = useState(() => new Set(done ? vocabulary.map((item) => item.id) : []));
  const allOpened = opened.size === vocabulary.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${vocabulary.length ? (opened.size * 100) / vocabulary.length : 0}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {opened.size} of {vocabulary.length} opened
        </span>
        {done ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Studied
          </Badge>
        ) : (
          <Button loading={busy} disabled={!allOpened || busy} onClick={onAllOpened}>
            {busy ? 'Saving…' : 'I have studied these words'}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Tap a card to see its meaning.</p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vocabulary.map((item) => (
          <li key={item.id} className="space-y-2">
            <WordFlipCard
              className="h-52"
              label={`${item.word}: show or hide the meaning`}
              highlight={opened.has(item.id)}
              onFlip={() => setOpened((current) => new Set(current).add(item.id))}
              front={
                <>
                  <span className="text-2xl font-bold">{item.word}</span>
                  <span className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{item.partOfSpeech}</Badge>
                    {item.phonetic ? <span>{item.phonetic}</span> : null}
                  </span>
                </>
              }
              back={
                <>
                  <span className="text-lg font-semibold">{item.meaning}</span>
                  {item.example ? <span className="text-sm">{item.example}</span> : null}
                  {item.exampleMeaning ? <span className="text-xs text-muted-foreground">{item.exampleMeaning}</span> : null}
                </>
              }
            />
            <div className="flex items-center gap-2">
              <Pronunciation label="US" url={item.audioUsUrl} />
              <Pronunciation label="UK" url={item.audioUkUrl} />
              {opened.has(item.id) ? <CheckCircle2 className="ml-auto h-4 w-4 text-success" aria-label="Opened" /> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';

function Pronunciation({ label, url }) {
  if (!url) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-6 font-semibold">{label}</span>
      <audio controls src={url} className="h-8 w-full max-w-[14rem]" />
    </div>
  );
}

// The lesson's words. Each card is opened to see its meaning; onAllOpened is
// called once every card has been opened. With `done` all cards start open.
export function VocabularyStudy({ vocabulary, done, busy, onAllOpened }) {
  const [opened, setOpened] = useState(() => new Set(done ? vocabulary.map((item) => item.id) : []));
  const allOpened = opened.size === vocabulary.length;

  function open(id) {
    setOpened((current) => new Set(current).add(id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Open every word to see its meaning: {opened.size} of {vocabulary.length} opened.
        </p>
        {done ? null : (
          <Button disabled={!allOpened || busy} onClick={onAllOpened}>
            {busy ? 'Saving…' : 'I have studied these words'}
          </Button>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {vocabulary.map((item) => {
          const isOpen = opened.has(item.id);
          return (
            <li key={item.id} className={cn('rounded-xl border bg-card p-4 shadow-sm', isOpen && 'border-primary/30')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{item.word}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{item.partOfSpeech}</Badge>
                    {item.phonetic ? <span>{item.phonetic}</span> : null}
                  </div>
                </div>
                {isOpen ? null : (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => open(item.id)}>
                    <Eye className="h-4 w-4" />
                    Open
                  </Button>
                )}
              </div>
              {isOpen ? (
                <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                  <p className="font-medium">{item.meaning}</p>
                  <p>{item.example}</p>
                  {item.exampleMeaning ? <p className="text-muted-foreground">{item.exampleMeaning}</p> : null}
                  <Pronunciation label="UK" url={item.audioUkUrl} />
                  <Pronunciation label="US" url={item.audioUsUrl} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

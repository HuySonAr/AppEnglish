import { Trash2, Wand2 } from 'lucide-react';
import { MediaKind, PartOfSpeech } from '@appenglish/content-contracts';
import { Badge, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { MediaField } from './MediaField.jsx';
import { TextField } from './TextField.jsx';
import { useReadOnly } from './ReadOnly.jsx';

export function VocabularyCard({ item, index, edit, update, media, filling, onAutofill }) {
  const path = ['vocabulary', index];
  const complete = item.word.trim() && item.partOfSpeech && item.meaning.trim() && item.example.trim();
  const filled = item.phonetic && item.audioUkMediaId && item.audioUsMediaId;
  const readOnly = useReadOnly();
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums">{index + 1}</span>
        <p className="min-w-0 flex-1 truncate font-medium">{item.word.trim() || 'New word'}</p>
        {complete ? null : <Badge variant="outline">Incomplete</Badge>}
        {readOnly ? null : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label={`Remove word ${index + 1}`}
            onClick={() => update((current) => ({ ...current, vocabulary: current.vocabulary.filter((entry) => entry.id !== item.id) }))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_11rem_1fr]">
        <TextField id={`word-${item.id}`} label="Word" value={item.word} maxLength={100} onChange={(value) => edit([...path, 'word'], value)} />
        <div className="space-y-2">
          <Label htmlFor={`pos-${item.id}`}>Part of speech</Label>
          <Select disabled={readOnly} value={item.partOfSpeech || undefined} onValueChange={(value) => edit([...path, 'partOfSpeech'], value)}>
            <SelectTrigger id={`pos-${item.id}`}>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PartOfSpeech).map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField id={`meaning-${item.id}`} label="Meaning" value={item.meaning} maxLength={300} onChange={(value) => edit([...path, 'meaning'], value)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextField id={`example-${item.id}`} label="Example sentence" value={item.example} maxLength={500} onChange={(value) => edit([...path, 'example'], value)} />
        <TextField id={`example-meaning-${item.id}`} label="Example translation (optional)" value={item.exampleMeaning} maxLength={500} onChange={(value) => edit([...path, 'exampleMeaning'], value)} />
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <TextField id={`phonetic-${item.id}`} label="Pronunciation (IPA)" value={item.phonetic} maxLength={100} placeholder="/ˈtɪkɪt/" onChange={(value) => edit([...path, 'phonetic'], value)} />
          </div>
          {readOnly ? null : (
            <Button
              variant="outline"
              className="gap-1.5"
              loading={filling === item.id}
              disabled={!item.word.trim() || filling !== null || Boolean(filled)}
              onClick={() => onAutofill(item)}
            >
              <Wand2 className="h-4 w-4" />
              {filling === item.id ? 'Generating…' : 'Auto-fill'}
            </Button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <MediaField id={`uk-${item.id}`} label="British audio" kind={MediaKind.AUDIO} path={[...path, 'audioUkMediaId']} mediaId={item.audioUkMediaId} media={media} />
          <MediaField id={`us-${item.id}`} label="American audio" kind={MediaKind.AUDIO} path={[...path, 'audioUsMediaId']} mediaId={item.audioUsMediaId} media={media} />
        </div>
      </div>
    </div>
  );
}

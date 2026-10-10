import { Trash2 } from 'lucide-react';
import { MediaKind, PartOfSpeech } from '@appenglish/content-contracts';
import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui';
import { MediaField } from './MediaField.jsx';
import { TextField } from './TextField.jsx';

// One vocabulary item of the lesson. edit(path, value) and update(change)
// come from the page; filling is the id of the item being looked up.
export function VocabularyCard({ item, index, edit, update, media, filling, onAutofill }) {
  const path = ['vocabulary', index];
  return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_12rem_1fr_auto]">
            <TextField id={`word-${item.id}`} label={`Word ${index + 1}`} value={item.word} maxLength={100} onChange={(value) => edit([...path, 'word'], value)} />
            <div className="space-y-2">
              <Label htmlFor={`pos-${item.id}`}>Part of speech</Label>
              <Select value={item.partOfSpeech || undefined} onValueChange={(value) => edit([...path, 'partOfSpeech'], value)}>
                <SelectTrigger id={`pos-${item.id}`}>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PartOfSpeech).map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TextField id={`phonetic-${item.id}`} label="Phonetic (IPA, optional)" value={item.phonetic} maxLength={100} placeholder="/ˈtɪkɪt/" onChange={(value) => edit([...path, 'phonetic'], value)} />
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove word ${index + 1}`}
                onClick={() => update((current) => ({ ...current, vocabulary: current.vocabulary.filter((entry) => entry.id !== item.id) }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <TextField id={`meaning-${item.id}`} label="Meaning (for this part of speech)" value={item.meaning} maxLength={300} onChange={(value) => edit([...path, 'meaning'], value)} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField id={`example-${item.id}`} label="Example sentence" value={item.example} maxLength={500} onChange={(value) => edit([...path, 'example'], value)} />
            <TextField id={`example-meaning-${item.id}`} label="Example translation (optional)" value={item.exampleMeaning} maxLength={500} onChange={(value) => edit([...path, 'exampleMeaning'], value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MediaField id={`uk-${item.id}`} label="Pronunciation — British (optional)" kind={MediaKind.AUDIO} path={[...path, 'audioUkMediaId']} mediaId={item.audioUkMediaId} media={media} />
            <MediaField id={`us-${item.id}`} label="Pronunciation — American (optional)" kind={MediaKind.AUDIO} path={[...path, 'audioUsMediaId']} mediaId={item.audioUsMediaId} media={media} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!item.word.trim() || filling !== null || (item.phonetic && item.audioUkMediaId && item.audioUsMediaId)}
              onClick={() => onAutofill(item)}
            >
              {filling === item.id ? 'Looking up…' : 'Auto-fill pronunciation'}
            </Button>
            <span className="text-sm text-muted-foreground">
              Fills the empty phonetic and audio fields from a free dictionary. Check them; replace anything wrong.
            </span>
          </div>
        </CardContent>
      </Card>
  );
}

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { cn } from '../../../lib/utils.js';
import { formatSeconds, listeningKindOf } from '../lib/listening-draft.js';

const kindName = (key) => {
  const kind = listeningKindOf(key);
  return kind ? (kind.number ? `Part ${kind.number}` : kind.title) : key;
};

// The recording of a lesson or a test section, chosen among the published
// exercises of the listening library (D100). library: the exercises list;
// exercise: the chosen one with its sentences and recording, when loaded.
// With chosen/onToggle the sentences can be ticked (close listening).
export function CourseExercisePicker({ id, library, value, exercise, onChange, chosen, onToggle, max }) {
  const published = library.filter((item) => item.publishedVersionNumber);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Recording from the listening library</Label>
      <Select value={value || undefined} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={published.length ? 'Choose a published exercise' : 'No published exercise yet'} />
        </SelectTrigger>
        <SelectContent>
          {published.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.title} · {item.level} · {kindName(item.kind)}
              {item.topic ? ` · ${item.topic.name}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && !exercise ? <p className="text-sm text-muted-foreground">Loading the recording…</p> : null}
      {exercise ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          {exercise.audioUrl ? <audio controls src={exercise.audioUrl} className="w-full" /> : null}
          {onToggle ? (
            <p className="text-sm text-muted-foreground">
              Tick the sentences learners write down ({chosen.length} of at most {max}).
            </p>
          ) : null}
          <ol className="space-y-1 text-sm">
            {exercise.segments.map((segment) => {
              const ticked = chosen?.includes(segment.id);
              return (
                <li key={segment.id}>
                  <label className={cn('flex items-start gap-2 rounded px-1 py-0.5', onToggle && 'cursor-pointer hover:bg-accent', ticked && 'bg-primary/10')}>
                    {onToggle ? (
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={Boolean(ticked)} onChange={() => onToggle(segment.id)} />
                    ) : null}
                    <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{formatSeconds(segment.start)}</span>
                    <span>
                      {segment.speaker ? <span className="font-medium">{segment.speaker}: </span> : null}
                      {segment.text}
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

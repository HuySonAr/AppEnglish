import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Volume2, Wand2 } from 'lucide-react';
import { Accent, COURSE_LIMITS, COURSE_RECORDING_KIND } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Switch } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { autofillPronunciation, getCourseAutoTime, requestCourseAutoTime, requestCourseTranscribe } from '../api/content-api.js';
import { blankCount, gapProblem, newIdea, newQuestion, newWord } from '../lib/course-draft.js';
import { listeningKindOf } from '../lib/listening-draft.js';
import { CourseQuestionEditor } from './CourseQuestionEditor.jsx';
import { RecordingEditor } from './RecordingEditor.jsx';

const recordingKind = listeningKindOf(COURSE_RECORDING_KIND);

const move = (list, index, by) => {
  const next = [...list];
  [next[index], next[index + by]] = [next[index + by], next[index]];
  return next;
};

function Section({ number, title, description, children, aside }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">
            {number}. {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {aside}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

// The words learned before listening (D143): IPA, meaning and a machine
// pronunciation from the speech service (D144). Several words can be
// pronounced at once; each answer is written into its own word.
function VocabularySection({ words, media, onChange, onMedia }) {
  // Ids of the words being pronounced right now.
  const [filling, setFilling] = useState(() => new Set());
  const { min, max } = COURSE_LIMITS.vocabulary;
  // Changes read the current words: answers may arrive while others are typed.
  const set = (id, change) => onChange((current) => current.map((word) => (word.id === id ? { ...word, ...change(word) } : word)));
  const mark = (id, busy) =>
    setFilling((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  // replace: a press on the word's own button makes its IPA and audio anew;
  // "Pronounce all" only fills what is missing.
  async function fill(word, { replace = false } = {}) {
    const text = word.word.trim();
    mark(word.id, true);
    try {
      const { found, phonetic, audio } = (await autofillPronunciation(text, [Accent.UK])).data;
      const asset = audio?.[Accent.UK];
      if (asset?.id && asset.url) onMedia(asset.id, asset.url);
      set(word.id, (current) =>
        replace
          ? { phonetic: phonetic || current.phonetic, audioMediaId: asset?.id || current.audioMediaId }
          : { phonetic: current.phonetic || phonetic || '', audioMediaId: current.audioMediaId || asset?.id || null },
      );
      if (!found || !asset) notify({ title: `"${text}" could not be pronounced`, description: 'Enter the IPA yourself and try again later.', variant: 'destructive' });
      return Boolean(found && asset);
    } catch (error) {
      notify({ title: `Could not pronounce "${text}"`, description: getApiErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      mark(word.id, false);
    }
  }

  // Every word with text that still lacks its IPA or its audio, all at once.
  const waiting = words.filter((word) => word.word.trim() && (!word.phonetic || !word.audioMediaId) && !filling.has(word.id));
  async function fillAll() {
    const done = (await Promise.all(waiting.map((word) => fill(word)))).filter(Boolean).length;
    if (done) notify({ title: `${done} word${done === 1 ? '' : 's'} pronounced` });
  }

  return (
    <Section
      number={2}
      title="Vocabulary"
      description={`${min} to ${max} key words of the recording.`}
      aside={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!waiting.length} onClick={fillAll}>
            <Wand2 className="h-4 w-4" />
            Pronounce all
          </Button>
          <Badge variant={words.length >= min && words.length <= max ? 'success' : 'secondary'}>
            {words.length} of {min}–{max}
          </Badge>
        </div>
      }
    >
      {words.length === 0 ? <p className="text-sm text-muted-foreground">No word yet.</p> : null}
      {words.map((word, index) => (
        <div key={word.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor={`word-${word.id}`}>Word {index + 1}</Label>
            <Input id={`word-${word.id}`} maxLength={100} value={word.word} onChange={(event) => set(word.id, () => ({ word: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`ipa-${word.id}`}>IPA</Label>
            <Input id={`ipa-${word.id}`} maxLength={100} placeholder="/ˈwɜːd/" value={word.phonetic} onChange={(event) => set(word.id, () => ({ phonetic: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`meaning-${word.id}`}>Meaning (Vietnamese)</Label>
            <Input id={`meaning-${word.id}`} maxLength={300} value={word.meaning} onChange={(event) => set(word.id, () => ({ meaning: event.target.value }))} />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="gap-1.5" loading={filling.has(word.id)} disabled={!word.word.trim() || filling.has(word.id)} onClick={() => fill(word, { replace: true }).then((ok) => ok && notify({ title: `"${word.word.trim()}" pronounced` }))}>
              <Wand2 className="h-4 w-4" />
              Pronounce
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={`Play ${word.word || 'word'}`}
              disabled={!media[word.audioMediaId]}
              onClick={() => new Audio(media[word.audioMediaId]).play().catch(() => {})}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Remove word ${index + 1}`} onClick={() => onChange((current) => current.filter((item) => item.id !== word.id))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" disabled={words.length >= max} onClick={() => onChange((current) => [...current, newWord()])}>
        <Plus className="h-4 w-4" />
        Add a word
      </Button>
    </Section>
  );
}

function QuestionsSection({ questions, onChange }) {
  return (
    <Section
      number={3}
      title="Multiple choice"
      description="Questions about the recording, each with one correct option."
      aside={<Badge variant={questions.length ? 'success' : 'secondary'}>{questions.length} question{questions.length === 1 ? '' : 's'}</Badge>}
    >
      {questions.map((question, index) => (
        <CourseQuestionEditor
          key={question.id}
          id={question.id}
          label={`Question ${index + 1}`}
          question={question}
          onChange={(next) => onChange(questions.map((item) => (item.id === question.id ? next : item)))}
          onRemove={() => onChange(questions.filter((item) => item.id !== question.id))}
        />
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" disabled={questions.length >= COURSE_LIMITS.questions.max} onClick={() => onChange([...questions, newQuestion()])}>
        <Plus className="h-4 w-4" />
        Add a question
      </Button>
    </Section>
  );
}

// Ideas in the order they are heard; learners get them shuffled (D143).
function OrderingSection({ ordering, onChange }) {
  const { min, max } = COURSE_LIMITS.ordering;
  const setItems = (items) => onChange({ ...ordering, items });
  return (
    <Section
      number={4}
      title="Put in order"
      description="Write the ideas in the order they are heard."
      aside={
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={ordering.enabled} onCheckedChange={(enabled) => onChange({ ...ordering, enabled, items: enabled && !ordering.items.length ? [newIdea(), newIdea(), newIdea()] : ordering.items })} aria-label="Use the ordering task" />
          {ordering.enabled ? 'On' : 'Off'}
        </label>
      }
    >
      {ordering.enabled ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="ordering-prompt">Instruction (optional)</Label>
            <Input id="ordering-prompt" maxLength={300} placeholder="Put the events in the order you hear them." value={ordering.prompt} onChange={(event) => onChange({ ...ordering, prompt: event.target.value })} />
          </div>
          <ol className="space-y-2">
            {ordering.items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="w-6 text-sm font-semibold text-muted-foreground">{index + 1}</span>
                <Input aria-label={`Idea ${index + 1}`} maxLength={300} value={item.text} onChange={(event) => setItems(ordering.items.map((other) => (other.id === item.id ? { ...other, text: event.target.value } : other)))} />
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move idea ${index + 1} up`} disabled={index === 0} onClick={() => setItems(move(ordering.items, index, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move idea ${index + 1} down`} disabled={index === ordering.items.length - 1} onClick={() => setItems(move(ordering.items, index, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove idea ${index + 1}`} onClick={() => setItems(ordering.items.filter((other) => other.id !== item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={ordering.items.length >= max} onClick={() => setItems([...ordering.items, newIdea()])}>
              <Plus className="h-4 w-4" />
              Add an idea
            </Button>
            <span className="text-sm text-muted-foreground">
              {min} to {max} ideas.
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Off: learners do not see this task for this topic.</p>
      )}
    </Section>
  );
}

// What a topic adds under each sentence of its recording (D143, D147): the
// words learners write in the blanks mode, in [brackets], and the Vietnamese
// translation shown with the transcript.
function SentenceExtra({ segment, label, onChange }) {
  const problem = gapProblem(segment.gap, segment.text);
  return (
    <div className="grid gap-2 border-t pt-3 lg:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`gap-${segment.id}`} className="flex items-center gap-2">
          Blanks (optional)
          {!segment.gap && segment.text ? (
            <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={() => onChange({ gap: segment.text })}>
              Start from the sentence
            </button>
          ) : null}
        </Label>
        <Input
          id={`gap-${segment.id}`}
          aria-label={`${label} blanks`}
          maxLength={600}
          placeholder="e.g. I'd like a [coffee], please."
          className={cn(problem && 'border-destructive')}
          value={segment.gap}
          onChange={(event) => onChange({ gap: event.target.value })}
        />
        {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`translation-${segment.id}`}>Translation (Vietnamese)</Label>
        <Textarea id={`translation-${segment.id}`} rows={1} maxLength={1000} value={segment.translation} onChange={(event) => onChange({ translation: event.target.value })} />
      </div>
    </div>
  );
}

// The editor of one topic (D143, D147): its own recording and sentences
// (with blanks and translation), then vocabulary, questions and ordering.
export function CourseTopicEditor({ itemId, title, content, onChange, edit, setSegments, draftMedia, beforeJob, wordMedia, onWordMedia }) {
  // value may be a function of the field's current value (vocabulary answers
  // arrive one by one).
  const set = (field) => (value) => onChange((current) => ({ ...current, [field]: typeof value === 'function' ? value(current[field]) : value }));
  const blanks = blankCount(content.segments);
  return (
    <div className="space-y-4">
      {/* Not a card: the recording and every sentence are cards of their own. */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">1. Recording and sentences</h2>
            <p className="text-sm text-muted-foreground">
              Upload the audio, add the transcript, then use Auto-time. Mark blanks with [brackets].
            </p>
          </div>
          <Badge variant={blanks ? 'success' : 'secondary'}>
            {blanks} blank{blanks === 1 ? '' : 's'}
          </Badge>
        </div>
        <RecordingEditor
          ownerId={itemId}
          kind={recordingKind}
          content={content}
          title={title}
          edit={edit}
          setSegments={setSegments}
          draftMedia={draftMedia}
          heading="Sentences"
          jobs={{
            get: async () => (await getCourseAutoTime(itemId)).data.job,
            request: async (task) => (await (task === 'transcribe' ? requestCourseTranscribe : requestCourseAutoTime)(itemId)).data.job,
          }}
          beforeJob={beforeJob}
          segmentExtra={(segment, index) => (
            <SentenceExtra segment={segment} label={`Sentence ${index + 1}`} onChange={(change) => setSegments((current) => current.map((item, at) => (at === index ? { ...item, ...change } : item)))} />
          )}
        />
      </div>
      <VocabularySection words={content.vocabulary} media={wordMedia} onChange={set('vocabulary')} onMedia={onWordMedia} />
      <QuestionsSection questions={content.questions} onChange={set('questions')} />
      <OrderingSection ordering={content.ordering} onChange={set('ordering')} />
    </div>
  );
}

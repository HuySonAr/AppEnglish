import { useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2, Volume2, Wand2 } from 'lucide-react';
import { Accent, COURSE_LIMITS, COURSE_RECORDING_KIND } from '@appenglish/content-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { playSound } from '../../../lib/audio.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Input, Label, Switch } from '../../../components/ui';
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

const sectionOf = (path) => (path.startsWith('vocabulary') ? 'vocabulary' : path.startsWith('questions') ? 'questions' : path.startsWith('ordering') ? 'ordering' : 'recording');

function SectionHead({ title, hint, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function AddButton({ disabled, onClick, children }) {
  return (
    <Button variant="outline" className="w-full gap-1.5 border-dashed" disabled={disabled} onClick={onClick}>
      <Plus className="h-4 w-4" />
      {children}
    </Button>
  );
}

function VocabularySection({ words, media, onChange, onMedia }) {
  const [filling, setFilling] = useState(() => new Set());
  const { min, max } = COURSE_LIMITS.vocabulary;
  const set = (id, change) => onChange((current) => current.map((word) => (word.id === id ? { ...word, ...change(word) } : word)));
  const mark = (id, busy) =>
    setFilling((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

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

  const waiting = words.filter((word) => word.word.trim() && (!word.phonetic || !word.audioMediaId) && !filling.has(word.id));
  async function fillAll() {
    const done = (await Promise.all(waiting.map((word) => fill(word)))).filter(Boolean).length;
    if (done) notify({ title: `${done} word${done === 1 ? '' : 's'} pronounced` });
  }

  return (
    <div className="space-y-3">
      <SectionHead title="Vocabulary" hint={`${min} to ${max} key words of the recording.`}>
        <Badge variant={words.length >= min && words.length <= max ? 'success' : 'outline'} className="tabular-nums">
          {words.length}/{max} words
        </Badge>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!waiting.length} onClick={fillAll}>
          <Wand2 className="h-4 w-4" />
          Pronounce all
        </Button>
      </SectionHead>
      {words.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No word yet.</p> : null}
      {words.map((word, index) => (
        <div key={word.id} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm">
          <span className="mb-1 flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums">{index + 1}</span>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
            <div className="space-y-1">
              <Label htmlFor={`word-${word.id}`} className="text-xs">
                Word
              </Label>
              <Input id={`word-${word.id}`} maxLength={100} value={word.word} onChange={(event) => set(word.id, () => ({ word: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ipa-${word.id}`} className="text-xs">
                IPA
              </Label>
              <Input id={`ipa-${word.id}`} maxLength={100} placeholder="/ˈwɜːd/" value={word.phonetic} onChange={(event) => set(word.id, () => ({ phonetic: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`meaning-${word.id}`} className="text-xs">
                Meaning (Vietnamese)
              </Label>
              <Input id={`meaning-${word.id}`} maxLength={300} value={word.meaning} onChange={(event) => set(word.id, () => ({ meaning: event.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              loading={filling.has(word.id)}
              disabled={!word.word.trim() || filling.has(word.id)}
              onClick={() => fill(word, { replace: true }).then((ok) => ok && notify({ title: `"${word.word.trim()}" pronounced` }))}
            >
              <Wand2 className="h-4 w-4" />
              Pronounce
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Play ${word.word || 'word'}`} disabled={!media[word.audioMediaId]} onClick={() => playSound(media[word.audioMediaId]).catch(() => {})}>
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label={`Remove word ${index + 1}`} onClick={() => onChange((current) => current.filter((item) => item.id !== word.id))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <AddButton disabled={words.length >= max} onClick={() => onChange((current) => [...current, newWord()])}>
        Add a word
      </AddButton>
    </div>
  );
}

function QuestionsSection({ questions, onChange }) {
  return (
    <div className="space-y-3">
      <SectionHead title="Multiple choice" hint="Questions about the recording.">
        <Badge variant={questions.length ? 'success' : 'outline'} className="tabular-nums">
          {questions.length} question{questions.length === 1 ? '' : 's'}
        </Badge>
      </SectionHead>
      {questions.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No question yet.</p> : null}
      {questions.map((question, index) => (
        <CourseQuestionEditor
          key={question.id}
          id={question.id}
          number={index + 1}
          label={`Question ${index + 1}`}
          question={question}
          onChange={(next) => onChange(questions.map((item) => (item.id === question.id ? next : item)))}
          onRemove={() => onChange(questions.filter((item) => item.id !== question.id))}
        />
      ))}
      <AddButton disabled={questions.length >= COURSE_LIMITS.questions.max} onClick={() => onChange([...questions, newQuestion()])}>
        Add a question
      </AddButton>
    </div>
  );
}

function OrderingSection({ ordering, onChange }) {
  const { min, max } = COURSE_LIMITS.ordering;
  const setItems = (items) => onChange({ ...ordering, items });
  const turnOn = () => onChange({ ...ordering, enabled: true, items: ordering.items.length ? ordering.items : [newIdea(), newIdea(), newIdea()] });
  return (
    <div className="space-y-3">
      <SectionHead title="Put in order" hint={`Optional; write ${min} to ${max} items in the correct order.`}>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={ordering.enabled} onCheckedChange={(enabled) => (enabled ? turnOn() : onChange({ ...ordering, enabled: false }))} aria-label="Use the ordering task" />
          {ordering.enabled ? 'On' : 'Off'}
        </label>
      </SectionHead>
      {ordering.enabled ? (
        <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="space-y-1">
            <Label htmlFor="ordering-prompt">Instruction</Label>
            <Input
              id="ordering-prompt"
              maxLength={300}
              placeholder="Put the tasks in order of priority."
              value={ordering.prompt}
              onChange={(event) => onChange({ ...ordering, prompt: event.target.value })}
            />
          </div>
          <ol className="space-y-2">
            {ordering.items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{index + 1}</span>
                <Input aria-label={`Item ${index + 1}`} maxLength={300} value={item.text} onChange={(event) => setItems(ordering.items.map((other) => (other.id === item.id ? { ...other, text: event.target.value } : other)))} />
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => setItems(move(ordering.items, index, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move item ${index + 1} down`} disabled={index === ordering.items.length - 1} onClick={() => setItems(move(ordering.items, index, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remove item ${index + 1}`} onClick={() => setItems(ordering.items.filter((other) => other.id !== item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ol>
          <AddButton disabled={ordering.items.length >= max} onClick={() => setItems([...ordering.items, newIdea()])}>
            Add an item
          </AddButton>
        </div>
      ) : (
        <AddButton onClick={turnOn}>Add an ordering task</AddButton>
      )}
    </div>
  );
}

function SentenceExtra({ segment, label, onChange }) {
  const problem = gapProblem(segment.gap, segment.text);
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor={`gap-${segment.id}`} className="flex items-center gap-2 text-xs">
          Blanks (optional)
          {!segment.gap && segment.text ? (
            <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={() => onChange({ gap: segment.text })}>
              Copy the sentence
            </button>
          ) : null}
        </Label>
        <Input
          id={`gap-${segment.id}`}
          aria-label={`${label} blanks`}
          maxLength={600}
          placeholder="I'd like a [coffee], please."
          className={cn('h-9 text-sm', problem && 'border-destructive')}
          value={segment.gap}
          onChange={(event) => onChange({ gap: event.target.value })}
        />
        {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`translation-${segment.id}`} className="text-xs">
          Translation (Vietnamese)
        </Label>
        <Textarea id={`translation-${segment.id}`} rows={1} maxLength={1000} className="min-h-9 text-sm" value={segment.translation} onChange={(event) => onChange({ translation: event.target.value })} />
      </div>
    </div>
  );
}

export function CourseTopicEditor({ itemId, title, content, onChange, edit, setSegments, draftMedia, beforeJob, wordMedia, onWordMedia, issues = [] }) {
  const [section, setSection] = useState('recording');
  const set = (field) => (value) => onChange((current) => ({ ...current, [field]: typeof value === 'function' ? value(current[field]) : value }));
  const { segments, vocabulary, questions, ordering } = content;
  const blanks = blankCount(segments);
  const timed = segments.filter((segment) => segment.start !== null && segment.end !== null && segment.end > segment.start).length;
  const issueCount = (key) => issues.filter((issue) => sectionOf(issue.path) === key).length;
  const steps = [
    { key: 'recording', title: 'Recording', detail: `${timed}/${segments.length} timed · ${blanks} blank${blanks === 1 ? '' : 's'}`, done: Boolean(content.audioMediaId) && segments.length > 0 && timed === segments.length },
    { key: 'vocabulary', title: 'Vocabulary', detail: `${vocabulary.length} word${vocabulary.length === 1 ? '' : 's'}`, done: vocabulary.length >= COURSE_LIMITS.vocabulary.min && vocabulary.length <= COURSE_LIMITS.vocabulary.max },
    { key: 'questions', title: 'Multiple choice', detail: `${questions.length} question${questions.length === 1 ? '' : 's'}`, done: questions.length > 0 && questions.every((question) => question.options.some((option) => option.isCorrect)) },
    { key: 'ordering', title: 'Put in order', detail: ordering.enabled ? `${ordering.items.length} items` : 'Optional', done: ordering.enabled && ordering.items.length >= COURSE_LIMITS.ordering.min },
  ];

  return (
    <div className="space-y-4">
      <nav aria-label="Topic sections" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const active = step.key === section;
          const found = issueCount(step.key);
          return (
            <button
              key={step.key}
              type="button"
              aria-current={active ? 'step' : undefined}
              onClick={() => setSection(step.key)}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-primary ring-1 ring-primary' : 'hover:bg-accent',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  active ? 'bg-primary text-primary-foreground' : step.done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                )}
              >
                {step.done && !active ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{step.title}</span>
                <span className="block truncate text-xs tabular-nums text-muted-foreground">{step.detail}</span>
              </span>
              {found ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {found}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {section === 'recording' ? (
        <RecordingEditor
          ownerId={itemId}
          kind={recordingKind}
          content={content}
          title={title}
          edit={edit}
          setSegments={setSegments}
          draftMedia={draftMedia}
          heading="Sentences"
          hint="Upload the audio, add the sentences, then Auto-time."
          jobs={{
            get: async () => (await getCourseAutoTime(itemId)).data.job,
            request: async (task) => (await (task === 'transcribe' ? requestCourseTranscribe : requestCourseAutoTime)(itemId)).data.job,
          }}
          beforeJob={beforeJob}
          segmentExtra={(segment, index) => (
            <SentenceExtra segment={segment} label={`Sentence ${index + 1}`} onChange={(change) => setSegments((current) => current.map((item, at) => (at === index ? { ...item, ...change } : item)))} />
          )}
        />
      ) : null}
      {section === 'vocabulary' ? <VocabularySection words={vocabulary} media={wordMedia} onChange={set('vocabulary')} onMedia={onWordMedia} /> : null}
      {section === 'questions' ? <QuestionsSection questions={questions} onChange={set('questions')} /> : null}
      {section === 'ordering' ? <OrderingSection ordering={ordering} onChange={set('ordering')} /> : null}
    </div>
  );
}

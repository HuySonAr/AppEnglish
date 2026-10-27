import { useState } from 'react';
import { AudioLines, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  FILL_IN_BLANK,
  MOCK_GROUPED_PARTS,
  MOCK_GRAPHIC_SET_INDEXES,
  MOCK_GROUP_AUDIO_PARTS,
  MOCK_QUESTION_AUDIO_PARTS,
  MOCK_SET_QUESTION_COUNT,
  MOCK_TEST_PART_COUNTS,
  MediaKind,
  Skill,
} from '@appenglish/content-contracts';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { Badge, Button, Input, Label } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { hasTable } from '../../../lib/passage.js';
import { cn } from '../../../lib/utils.js';
import { withCorrectOption } from '../lib/lesson-draft.js';
import { MOCK_FIRST_QUESTION_NUMBERS, MOCK_PASTE_PARTS, graphicQuestion, mockQuestionNumber, withGraphicOn, withGroup, withQuestion, withoutGroup, withoutQuestion } from '../lib/mock-draft.js';
import { MediaField } from './MediaField.jsx';
import { PasteQuestionsDialog } from './PasteQuestionsDialog.jsx';
import { TextField } from './TextField.jsx';
import { useReadOnly } from './ReadOnly.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { [Skill.LISTENING]: 'Listening', [Skill.READING]: 'Reading' };

const TRANSCRIPT_MAX_LENGTH = 10000;

function TranscribeStatus({ job, onUse, onDismiss }) {
  if (job.status === 'QUEUED' || job.status === 'RUNNING')
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Transcribing; you can keep working.
      </p>
    );
  if (job.status === 'FAILED')
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
        <span className="flex-1">Transcribe failed: {job.error}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    );
  const text = job.lines.map((line) => line.text).join('\n');
  return (
    <div role="status" className="space-y-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
      <p className="max-h-32 overflow-y-auto whitespace-pre-line text-muted-foreground">{text || 'No speech was heard.'}</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={!text} onClick={() => onUse(text.slice(0, TRANSCRIPT_MAX_LENGTH))}>
          Use this transcript
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function Recording({ id, label, path, item, edit, media, speech }) {
  const [starting, setStarting] = useState(false);
  const readOnly = useReadOnly();
  const job = speech?.jobOf(item.audioMediaId);
  const active = job?.status === 'QUEUED' || job?.status === 'RUNNING';
  async function transcribe() {
    setStarting(true);
    await speech.request(path);
    setStarting(false);
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MediaField id={`${id}-audio`} label={label} kind={MediaKind.AUDIO} path={[...path, 'audioMediaId']} mediaId={item.audioMediaId} media={media} />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-transcript`}>Transcript</Label>
          {speech && !readOnly ? (
            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2" loading={starting} disabled={starting || active || !item.audioMediaId} onClick={transcribe}>
              <AudioLines className="h-3.5 w-3.5" />
              Transcribe
            </Button>
          ) : null}
        </div>
        <Textarea id={`${id}-transcript`} readOnly={readOnly} value={item.transcript} maxLength={TRANSCRIPT_MAX_LENGTH} rows={4} onChange={(event) => edit([...path, 'transcript'], event.target.value)} />
        {job && !readOnly ? (
          <TranscribeStatus
            job={job}
            onDismiss={() => speech.dismiss(job)}
            onUse={(text) => {
              edit([...path, 'transcript'], text);
              speech.dismiss(job);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function QuestionCard({ spec, question, number, path, edit, media, speech, onRemove, graphicAction = null, recording = MOCK_QUESTION_AUDIO_PARTS.includes(spec.key), lettersOnly = !spec.option.text, subtitle = null }) {
  const id = `${spec.key}-${question.id}`;
  const answered = question.options.some((option) => option.isCorrect);
  const readOnly = useReadOnly();
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums">{number}</span>
        <p className="font-medium">
          Question {number}
          {subtitle ? <span className="font-normal text-muted-foreground"> · {subtitle}</span> : null}
        </p>
        {answered ? null : <Badge variant="outline">No answer</Badge>}
        {graphicAction}
        {onRemove && !readOnly ? (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remove question ${number}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {recording ? <Recording id={id} label="Recording" path={path} item={question} edit={edit} media={media} speech={speech} /> : null}
      {spec.question.image ? (
        <MediaField id={`${id}-image`} label="Photograph" kind={MediaKind.IMAGE} path={[...path, 'imageMediaId']} mediaId={question.imageMediaId} media={media} />
      ) : null}
      {spec.question.prompt ? (
        <TextField id={`${id}-prompt`} label="Question" value={question.prompt} maxLength={1000} onChange={(value) => edit([...path, 'prompt'], value)} />
      ) : null}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Options · pick the correct one</legend>
        <div className={cn('grid gap-2', lettersOnly ? 'grid-cols-4' : '')}>
          {question.options.map((option, optionIndex) => {
            const letter = optionLetters[optionIndex];
            return (
              <div
                key={option.id}
                className={cn('flex items-center gap-2 rounded-lg border p-1.5 transition-colors', option.isCorrect ? 'border-success bg-success/10' : 'bg-background')}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={option.isCorrect}
                  disabled={readOnly}
                  aria-label={`Option ${letter} is correct`}
                  onClick={() => edit(path, withCorrectOption(question, option.id))}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    option.isCorrect ? 'bg-success text-white' : 'bg-muted hover:bg-accent',
                    lettersOnly ? 'w-full' : '',
                  )}
                >
                  {option.isCorrect ? <Check className="h-4 w-4" /> : letter}
                </button>
                {!lettersOnly ? (
                  <Input
                    className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1"
                    aria-label={`Option ${letter} text`}
                    readOnly={readOnly}
                    placeholder={`Option ${letter}`}
                    value={option.text}
                    maxLength={300}
                    onChange={(event) => edit([...path, 'options', optionIndex, 'text'], event.target.value)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      <TextField id={`${id}-explanation`} label="Explanation" value={question.explanation} maxLength={2000} multiline onChange={(value) => edit([...path, 'explanation'], value)} />
    </div>
  );
}

export function MockPartEditor({ spec, part, edit, updatePart, media, speech, target: targetProp, firstNumber: firstNumberProp, maxSets: maxSetsProp, setQuestionLimit, hint, paste = true }) {
  const base = ['test', spec.key];
  const readOnly = useReadOnly();
  const grouped = MOCK_GROUPED_PARTS.includes(spec.key);
  const groupAudio = MOCK_GROUP_AUDIO_PARTS.includes(spec.key);
  const setName = groupAudio ? (spec.key === 'part3' ? 'Conversation' : 'Talk') : 'Passage';
  const setNoun = setName.toLowerCase();
  const target = targetProp ?? MOCK_TEST_PART_COUNTS[spec.key];
  const graphicSets = MOCK_GRAPHIC_SET_INDEXES[spec.key] || [];
  const graphicRange = graphicSets.length ? `${graphicSets[0] + 1}–${graphicSets.at(-1) + 1}` : '';
  const firstNumber = firstNumberProp ?? MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const numberOf = (question) =>
    firstNumberProp === undefined ? mockQuestionNumber(spec, part, part.questions.indexOf(question)) : firstNumber + part.questions.indexOf(question);
  const partFull = part.questions.length >= target;
  const maxSets = maxSetsProp ?? (groupAudio ? target / MOCK_SET_QUESTION_COUNT : Infinity);
  const setLimit = setQuestionLimit ?? (groupAudio ? MOCK_SET_QUESTION_COUNT : Infinity);
  const defaultHint = groupAudio
    ? `Up to ${MOCK_SET_QUESTION_COUNT} questions per ${setNoun}; ${setNoun}s ${graphicRange} have a graphic.`
    : spec.option.text
      ? null
      : 'The recording reads the options; learners see only the letters.';
  const shownHint = hint ?? defaultHint;
  const card = (question, graphic = null) => (
    <QuestionCard
      key={question.id}
      spec={spec}
      question={question}
      number={numberOf(question)}
      path={[...base, 'questions', part.questions.indexOf(question)]}
      edit={edit}
      media={media}
      speech={speech}
      onRemove={() => updatePart((current) => withoutQuestion(current, question.id))}
      graphicAction={
        !graphic?.imageMediaId ? null : graphic === question ? (
          <Badge variant="secondary">Look at the graphic</Badge>
        ) : readOnly ? null : (
          <Button variant="outline" size="sm" className="h-7" onClick={() => updatePart((current) => withGraphicOn(current, question.groupId, question.id))}>
            Move graphic here
          </Button>
        )
      }
    />
  );
  const addButton = (label, onClick, disabled) => readOnly ? null : (
    <Button variant="outline" className="w-full gap-1.5 border-dashed" disabled={disabled} onClick={onClick}>
      <Plus className="h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {skillLabels[spec.skill]} · Questions {firstNumber}–{firstNumber + target - 1}
          </p>
          <h2 className="text-lg font-semibold">
            Part {spec.number}: {spec.title}
          </h2>
          {shownHint ? <p className="text-sm text-muted-foreground">{shownHint}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={part.questions.length >= target ? 'success' : 'outline'} className="tabular-nums">
            {part.questions.length}/{target} questions
          </Badge>
          {paste && !readOnly && MOCK_PASTE_PARTS.includes(spec.key) ? (
            <PasteQuestionsDialog spec={spec} part={part} setName={groupAudio ? setName : null} onApply={(pasted) => updatePart(() => pasted)} />
          ) : null}
        </div>
      </div>

      {grouped ? (
        <>
          {part.groups.map((group, groupIndex) => {
            const path = [...base, 'groups', groupIndex];
            const graphicSet = graphicSets.includes(groupIndex);
            const graphic = groupAudio ? graphicQuestion(part, group.id) : null;
            const showGraphic = graphic && (graphicSet || graphic.imageMediaId);
            const setQuestions = part.questions.filter((question) => question.groupId === group.id);
            const setFull = setQuestions.length >= setLimit;
            return (
              <div key={group.id} className="overflow-hidden rounded-xl border bg-muted/20">
                <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
                  <p className="font-semibold">
                    {setName} {groupIndex + 1}
                  </p>
                  <Badge variant="secondary" className="tabular-nums">
                    {setQuestions.length}
                    {Number.isFinite(setLimit) ? `/${setLimit}` : ''} questions
                  </Badge>
                  {graphicSet ? <Badge variant="info">Graphic</Badge> : null}
                  {readOnly ? null : (
                    <Button variant="ghost" size="sm" className="ml-auto h-8 gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => updatePart((current) => withoutGroup(current, group.id))}>
                      <Trash2 className="h-4 w-4" />
                      Remove {setNoun}
                    </Button>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  {groupAudio ? (
                    <Recording id={`${spec.key}-${group.id}`} label="Recording" path={path} item={group} edit={edit} media={media} speech={speech} />
                  ) : (
                    <TextField
                      id={`${spec.key}-${group.id}-passage`}
                      label={spec.group.blanks ? `Passage (type ${FILL_IN_BLANK} for each blank)` : 'Document (a table row: | cell | cell |)'}
                      value={group.passage}
                      maxLength={10000}
                      multiline
                      rows={6}
                      onChange={(value) => edit([...path, 'passage'], value)}
                    />
                  )}
                  {!groupAudio && !spec.group.blanks && hasTable(group.passage) ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Preview</p>
                      <div className="rounded-xl border bg-card p-4 leading-relaxed">
                        <PassageText text={group.passage} />
                      </div>
                    </div>
                  ) : null}
                  {spec.group.optionalImage ? (
                    <MediaField id={`${spec.key}-${group.id}-image`} label="Document image (optional)" kind={MediaKind.IMAGE} path={[...path, 'imageMediaId']} mediaId={group.imageMediaId} media={media} />
                  ) : null}
                  {showGraphic ? (
                    <MediaField
                      id={`${spec.key}-${group.id}-graphic`}
                      label={graphicSet ? `Graphic for question ${numberOf(graphic)}` : `Graphic for question ${numberOf(graphic)} (remove it)`}
                      kind={MediaKind.IMAGE}
                      path={[...base, 'questions', part.questions.indexOf(graphic), 'imageMediaId']}
                      mediaId={graphic.imageMediaId}
                      media={media}
                    />
                  ) : null}
                  {graphicSet && !graphic ? <p className="text-sm text-muted-foreground">Add the questions first; the graphic goes on the middle one.</p> : null}
                  {setQuestions.map((question) => card(question, graphic))}
                  {addButton(`Add question to ${setNoun} ${groupIndex + 1}`, () => updatePart((current) => withQuestion(current, spec, group.id)), partFull || setFull)}
                </div>
              </div>
            );
          })}
          {part.groups.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No {setNoun} yet.</p> : null}
          {addButton(`Add ${setNoun}`, () => updatePart(withGroup), partFull || part.groups.length >= maxSets)}
        </>
      ) : (
        <>
          {part.questions.map((question) => card(question))}
          {part.questions.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No question yet.</p> : null}
          {addButton('Add question', () => updatePart((current) => withQuestion(current, spec)), partFull)}
        </>
      )}
    </div>
  );
}

import { Plus, Trash2 } from 'lucide-react';
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
import { Badge, Button, Card, CardContent, Input } from '../../../components/ui';
import { hasTable } from '../../../lib/passage.js';
import { withCorrectOption } from '../lib/lesson-draft.js';
import { MOCK_FIRST_QUESTION_NUMBERS, MOCK_PASTE_PARTS, graphicQuestion, mockQuestionNumber, withGraphicOn, withGroup, withQuestion, withoutGroup, withoutQuestion } from '../lib/mock-draft.js';
import { MediaField } from './MediaField.jsx';
import { PasteQuestionsDialog } from './PasteQuestionsDialog.jsx';
import { TextField } from './TextField.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { [Skill.LISTENING]: 'Listening', [Skill.READING]: 'Reading' };

// A recording with its transcript, for a question (Parts 1-2) or a set
// (Parts 3-4).
function Recording({ id, label, path, item, edit, media }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MediaField id={`${id}-audio`} label={`${label} (MP3, MP4 or M4A)`} kind={MediaKind.AUDIO} path={[...path, 'audioMediaId']} mediaId={item.audioMediaId} media={media} />
      <TextField id={`${id}-transcript`} label="Transcript" value={item.transcript} maxLength={10000} multiline rows={4} onChange={(value) => edit([...path, 'transcript'], value)} />
    </div>
  );
}

// One question of a mock-test part. number is its number in the whole test.
// graphicAction is shown beside the number: what the question has to do with
// the graphic of its conversation or talk.
function QuestionCard({ spec, question, number, path, edit, media, onRemove, graphicAction = null }) {
  const id = `${spec.key}-${question.id}`;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">Question {number}</p>
            {graphicAction}
          </div>
          <Button variant="ghost" size="icon" aria-label={`Remove question ${number}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {MOCK_QUESTION_AUDIO_PARTS.includes(spec.key) ? (
          <Recording id={id} label={`Recording of question ${number}`} path={path} item={question} edit={edit} media={media} />
        ) : null}
        {spec.question.image ? (
          <MediaField id={`${id}-image`} label="Photograph (JPEG, PNG or WebP)" kind={MediaKind.IMAGE} path={[...path, 'imageMediaId']} mediaId={question.imageMediaId} media={media} />
        ) : null}
        {spec.question.prompt ? (
          <TextField id={`${id}-prompt`} label="Question text" value={question.prompt} maxLength={1000} onChange={(value) => edit([...path, 'prompt'], value)} />
        ) : null}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Options — select the correct answer</legend>
          {question.options.map((option, optionIndex) => {
            const letter = optionLetters[optionIndex];
            return (
              <div key={option.id} className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  aria-label={`Option ${letter} is correct`}
                  checked={option.isCorrect}
                  onChange={() => edit(path, withCorrectOption(question, option.id))}
                  className="h-4 w-4 accent-primary"
                />
                <span className="w-4 text-sm font-medium">{letter}</span>
                {spec.option.text ? (
                  <Input className="flex-1" aria-label={`Option ${letter} text`} value={option.text} maxLength={300} onChange={(event) => edit([...path, 'options', optionIndex, 'text'], event.target.value)} />
                ) : null}
              </div>
            );
          })}
        </fieldset>
        <TextField id={`${id}-explanation`} label="Explanation of the answer" value={question.explanation} maxLength={2000} multiline onChange={(value) => edit([...path, 'explanation'], value)} />
      </CardContent>
    </Card>
  );
}

// Editor of one mock-test part. Unlike a lesson-test part it holds any number
// of questions. Parts 1 and 2 have a recording per question. Parts 3, 4, 6
// and 7 are made of sets: a recording (3-4) or a passage (6-7) with its own
// questions.
// edit(path, value) sets one field; updatePart(change) replaces the part.
// Questions carry the number they have in a full test (1-200 across the
// parts). A part cannot hold more questions than a full test has there, and
// a conversation or talk no more than three.
export function MockPartEditor({ spec, part, edit, updatePart, media }) {
  const base = ['test', spec.key];
  const grouped = MOCK_GROUPED_PARTS.includes(spec.key);
  const groupAudio = MOCK_GROUP_AUDIO_PARTS.includes(spec.key);
  // What a set of this part is called.
  const setName = groupAudio ? (spec.key === 'part3' ? 'Conversation' : 'Talk') : 'Passage';
  const target = MOCK_TEST_PART_COUNTS[spec.key];
  // Sets that come with a graphic: conversations 11-13, talks 9-10.
  const graphicSets = MOCK_GRAPHIC_SET_INDEXES[spec.key] || [];
  const firstNumber = MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const numberOf = (question) => mockQuestionNumber(spec, part, part.questions.indexOf(question));
  const partFull = part.questions.length >= target;
  const maxSets = groupAudio ? target / MOCK_SET_QUESTION_COUNT : Infinity;
  // graphic is the question holding the graphic of the card's set, if any.
  const card = (question, graphic = null) => (
    <QuestionCard
      key={question.id}
      spec={spec}
      question={question}
      number={numberOf(question)}
      path={[...base, 'questions', part.questions.indexOf(question)]}
      edit={edit}
      media={media}
      onRemove={() => updatePart((current) => withoutQuestion(current, question.id))}
      graphicAction={
        !graphic?.imageMediaId ? null : graphic === question ? (
          <Badge variant="secondary">Look at the graphic</Badge>
        ) : (
          <Button variant="outline" size="sm" onClick={() => updatePart((current) => withGraphicOn(current, question.groupId, question.id))}>
            Move graphic here
          </Button>
        )
      }
    />
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">
          Part {spec.number}: {spec.title}
        </h3>
        <Badge variant={part.questions.length === target ? 'success' : 'outline'}>
          {part.questions.length} / {target} questions
        </Badge>
        <Badge variant="secondary">
          Questions {firstNumber}–{firstNumber + target - 1}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {skillLabels[spec.skill]} · a full TOEIC test has {target} here, the most this part can hold
          {spec.option.text ? '' : ' · each recording reads its options; learners see only the letters'}
          {groupAudio ? ` · one recording per ${setName.toLowerCase()}, with up to ${MOCK_SET_QUESTION_COUNT} questions · ${setName.toLowerCase()}s ${graphicSets[0] + 1}–${graphicSets.at(-1) + 1} each have a graphic on one question, usually the middle one` : ''}
        </span>
        {MOCK_PASTE_PARTS.includes(spec.key) ? (
          <PasteQuestionsDialog spec={spec} part={part} setName={groupAudio ? setName : null} onApply={(pasted) => updatePart(() => pasted)} />
        ) : null}
      </div>

      {grouped ? (
        <>
          {part.groups.map((group, groupIndex) => {
            const path = [...base, 'groups', groupIndex];
            const graphicSet = graphicSets.includes(groupIndex);
            // Also shown outside the graphic sets while a question still has
            // a graphic, so that it can be removed.
            const graphic = groupAudio ? graphicQuestion(part, group.id) : null;
            const showGraphic = graphic && (graphicSet || graphic.imageMediaId);
            const setQuestions = part.questions.filter((question) => question.groupId === group.id);
            const setFull = groupAudio && setQuestions.length >= MOCK_SET_QUESTION_COUNT;
            return (
              <div key={group.id} className="space-y-3 rounded-xl border border-dashed p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {setName} {groupIndex + 1}
                  </p>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => updatePart((current) => withoutGroup(current, group.id))}>
                    <Trash2 className="h-4 w-4" />
                    Remove with its questions
                  </Button>
                </div>
                {groupAudio ? (
                  <Recording id={`${spec.key}-${group.id}`} label={`Recording of ${setName.toLowerCase()} ${groupIndex + 1}`} path={path} item={group} edit={edit} media={media} />
                ) : (
                <TextField
                  id={`${spec.key}-${group.id}-passage`}
                  label={spec.group.blanks ? `Passage: type ${FILL_IN_BLANK} for each blank, one per question` : 'Document (letter, form, report, notice…). A table: one line per row, written | cell | cell |'}
                  value={group.passage}
                  maxLength={10000}
                  multiline
                  rows={6}
                  onChange={(value) => edit([...path, 'passage'], value)}
                />
                )}
                {!groupAudio && !spec.group.blanks && hasTable(group.passage) ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">As learners see it</p>
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
                    label={
                      graphicSet
                        ? `Graphic of question ${numberOf(graphic)}, the "Look at the graphic" question (JPEG, PNG or WebP)`
                        : `Graphic of question ${numberOf(graphic)} — remove it: only ${setName.toLowerCase()}s ${graphicSets[0] + 1}–${graphicSets.at(-1) + 1} have a graphic`
                    }
                    kind={MediaKind.IMAGE}
                    path={[...base, 'questions', part.questions.indexOf(graphic), 'imageMediaId']}
                    mediaId={graphic.imageMediaId}
                    media={media}
                  />
                ) : null}
                {graphicSet && !graphic ? (
                  <p className="text-sm text-muted-foreground">
                    This {setName.toLowerCase()} comes with a graphic. Add its questions first; the graphic goes on the middle one.
                  </p>
                ) : null}
                {setQuestions.map((question) => card(question, graphic))}
                <Button variant="outline" size="sm" className="gap-1.5" disabled={partFull || setFull} onClick={() => updatePart((current) => withQuestion(current, spec, group.id))}>
                  <Plus className="h-4 w-4" />
                  Add question to {setName.toLowerCase()} {groupIndex + 1}
                </Button>
              </div>
            );
          })}
          <Button variant="outline" className="gap-1.5" disabled={partFull || part.groups.length >= maxSets} onClick={() => updatePart(withGroup)}>
            <Plus className="h-4 w-4" />
            Add {setName.toLowerCase()}
          </Button>
        </>
      ) : (
        <>
          {part.questions.map((question) => card(question))}
          <Button variant="outline" className="gap-1.5" disabled={partFull} onClick={() => updatePart((current) => withQuestion(current, spec))}>
            <Plus className="h-4 w-4" />
            Add question
          </Button>
        </>
      )}
    </div>
  );
}

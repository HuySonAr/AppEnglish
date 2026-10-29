import { FILL_IN_BLANK, MediaKind, Skill } from '@appenglish/content-contracts';
import { PassageText } from '../../../components/shared/PassageText.jsx';
import { TableTool } from '../../../components/shared/TableTool.jsx';
import { Badge } from '../../../components/ui';
import { needsPreview } from '../../../lib/passage.js';
import { LESSON_PASTE_PARTS, lessonPasteDescription, lessonPastePlan } from '../lib/lesson-paste.js';
import { MediaField } from './MediaField.jsx';
import { QuestionCard } from './MockPartEditor.jsx';
import { PasteQuestionsDialog } from './PasteQuestionsDialog.jsx';
import { TextField } from './TextField.jsx';
import { useReadOnly } from './ReadOnly.jsx';

const skillLabels = { [Skill.LISTENING]: 'Listening', [Skill.READING]: 'Reading' };

export function questionRange(spec, prefix = spec.questionCount === 1 ? 'question ' : 'questions ') {
  const last = spec.firstQuestionNumber + spec.questionCount - 1;
  return `${prefix}${spec.firstQuestionNumber}${last > spec.firstQuestionNumber ? `–${last}` : ''}`;
}

export function partAnswered(part) {
  return part.questions.filter((question) => question.options.some((option) => option.isCorrect)).length;
}

export function PartEditor({ spec, part, edit, media }) {
  const base = ['test', spec.key];
  const lettersOnly = !spec.option.text;
  const answered = partAnswered(part);
  const readOnly = useReadOnly();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {skillLabels[spec.skill]} · {questionRange(spec, 'Questions ')}
          </p>
          <h2 className="text-lg font-semibold">
            Part {spec.number}: {spec.title}
          </h2>
          {lettersOnly ? <p className="text-sm text-muted-foreground">One recording reads the questions and options; learners see only the letters.</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={answered === part.questions.length ? 'success' : 'outline'} className="tabular-nums">
            {answered}/{part.questions.length} answered
          </Badge>
          {LESSON_PASTE_PARTS.includes(spec.key) && !readOnly ? (
            <PasteQuestionsDialog
              spec={spec}
              part={part}
              setName={null}
              planFor={lessonPastePlan}
              firstNumber={spec.firstQuestionNumber}
              exampleCount={spec.questionCount}
              description={lessonPasteDescription(spec)}
              onApply={(pasted) => edit(base, pasted)}
            />
          ) : null}
        </div>
      </div>

      {spec.group.audio || spec.group.passage ? (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          {spec.group.audio ? (
            <div className="grid gap-3 md:grid-cols-2">
              <MediaField id={`${spec.key}-group-audio`} label="Recording" kind={MediaKind.AUDIO} path={[...base, 'audioMediaId']} mediaId={part.audioMediaId} media={media} />
              <TextField id={`${spec.key}-group-transcript`} label="Transcript" value={part.transcript} maxLength={10000} multiline rows={4} onChange={(value) => edit([...base, 'transcript'], value)} />
            </div>
          ) : null}
          {spec.group.passage ? (
            <TextField
              id={`${spec.key}-passage`}
              label={spec.group.blanks ? `Passage (${spec.questionCount} blanks typed as ${FILL_IN_BLANK})` : 'Document (a table row: | cell | cell |)'}
              value={part.passage}
              maxLength={10000}
              multiline
              rows={8}
              onChange={(value) => edit([...base, 'passage'], value)}
              actions={!spec.group.blanks && !readOnly ? <TableTool targetId={`${spec.key}-passage`} value={part.passage || ''} maxLength={10000} onChange={(value) => edit([...base, 'passage'], value)} /> : null}
            />
          ) : null}
          {spec.group.passage && !spec.group.blanks && needsPreview(part.passage) ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>
              <div className="rounded-xl border bg-background p-4 leading-relaxed">
                <PassageText text={part.passage} />
              </div>
            </div>
          ) : null}
          {spec.group.optionalImage ? (
            <MediaField id={`${spec.key}-image`} label="Document image (optional)" kind={MediaKind.IMAGE} path={[...base, 'imageMediaId']} mediaId={part.imageMediaId} media={media} />
          ) : null}
        </div>
      ) : null}

      {part.questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          spec={spec}
          question={question}
          number={spec.firstQuestionNumber + index}
          path={[...base, 'questions', index]}
          edit={edit}
          media={media}
          recording={false}
          lettersOnly={lettersOnly}
          subtitle={spec.group.blanks ? `blank ${index + 1}` : null}
        />
      ))}
    </div>
  );
}

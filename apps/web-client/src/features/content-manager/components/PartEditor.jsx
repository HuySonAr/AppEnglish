import { FILL_IN_BLANK, MediaKind, Skill } from '@appenglish/content-contracts';
import { Card, CardContent, Input } from '../../../components/ui';
import { withCorrectOption } from '../lib/lesson-draft.js';
import { MediaField } from './MediaField.jsx';
import { TextField } from './TextField.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];
const skillLabels = { [Skill.LISTENING]: 'Listening', [Skill.READING]: 'Reading' };

// "question 1" or "questions 10–15": a part's numbers in the 23-question test.
export function questionRange(spec, prefix = spec.questionCount === 1 ? 'question ' : 'questions ') {
  const last = spec.firstQuestionNumber + spec.questionCount - 1;
  return `${prefix}${spec.firstQuestionNumber}${last > spec.firstQuestionNumber ? `–${last}` : ''}`;
}

// Audio always travels with its transcript.
function AudioWithTranscript({ id, label, path, item, edit, media, transcriptMax }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MediaField id={`${id}-audio`} label={`${label} audio (MP3, MP4 or M4A)`} kind={MediaKind.AUDIO} path={[...path, 'audioMediaId']} mediaId={item.audioMediaId} media={media} />
      <TextField id={`${id}-transcript`} label={`${label} transcript`} value={item.transcript} maxLength={transcriptMax} multiline={transcriptMax > 1000} onChange={(value) => edit([...path, 'transcript'], value)} />
    </div>
  );
}

// Editor of one lesson-test part: its shared audio/passage and questions.
export function PartEditor({ spec, part, edit, media }) {
  const base = ['test', spec.key];
  // Parts 1 and 2: the part recording reads the options, so only letters show.
  const lettersOnly = !spec.option.text;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          Part {spec.number}: {spec.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {skillLabels[spec.skill]} · {questionRange(spec)} · options{' '}
          {optionLetters.slice(0, spec.optionCount).join(', ')}
          {lettersOnly ? ' (one recording for the whole part reads the questions and options; learners see only the letters)' : ''}
        </p>
      </div>

      {spec.group.audio || spec.group.passage ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {spec.group.audio ? (
              <AudioWithTranscript id={`${spec.key}-group`} label={spec.title} path={base} item={part} edit={edit} media={media} transcriptMax={10000} />
            ) : null}
            {spec.group.passage ? (
              <TextField
                id={`${spec.key}-passage`}
                label={spec.group.blanks ? `Passage with exactly ${spec.questionCount} blanks, typed as ${FILL_IN_BLANK}` : 'Document (letter, form, report, notice…)'}
                value={part.passage}
                maxLength={10000}
                multiline
                rows={8}
                onChange={(value) => edit([...base, 'passage'], value)}
              />
            ) : null}
            {spec.group.optionalImage ? (
              <MediaField id={`${spec.key}-image`} label="Document image (optional)" kind={MediaKind.IMAGE} path={[...base, 'imageMediaId']} mediaId={part.imageMediaId} media={media} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {part.questions.map((question, index) => {
        const path = [...base, 'questions', index];
        const id = `${spec.key}-q${index}`;
        return (
          <Card key={question.id}>
            <CardContent className="space-y-4 pt-6">
              <p className="font-medium">
                Question {spec.firstQuestionNumber + index}
                {spec.group.blanks ? ` (blank ${index + 1})` : ''}
              </p>
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
                  const optionPath = [...path, 'options', optionIndex];
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
                      {lettersOnly ? null : (
                        <Input className="flex-1" aria-label={`Option ${letter} text`} value={option.text} maxLength={300} onChange={(event) => edit([...optionPath, 'text'], event.target.value)} />
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <TextField id={`${id}-explanation`} label="Explanation of the answer" value={question.explanation} maxLength={2000} multiline onChange={(value) => edit([...path, 'explanation'], value)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

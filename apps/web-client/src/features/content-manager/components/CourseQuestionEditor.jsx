import { Plus, Trash2 } from 'lucide-react';
import { COURSE_LIMITS, CourseQuestionKind, CourseSkill, FILL_IN_BLANK } from '@appenglish/content-contracts';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { withBlankAnswers, withCorrect, withKind, withOption } from '../lib/course-draft.js';
import { TextField } from './TextField.jsx';

const letters = ['A', 'B', 'C', 'D'];
const skillLabels = { [CourseSkill.GIST]: 'Main idea', [CourseSkill.DETAIL]: 'Detail', [CourseSkill.INFERENCE]: 'Inference' };
const kindLabels = { [CourseQuestionKind.CHOICE]: 'Multiple choice', [CourseQuestionKind.COMPLETE]: 'Complete the sentence' };

// One question of the Listening course (D100): the question, two to four
// options with the right one, the skill it checks and why the answer is
// right; or (allowComplete, detail questions, D109) a sentence with blanks
// (___) and the words heard for each. fixedSkill hides the skill choice (the
// gist question).
export function CourseQuestionEditor({ id, label, question, onChange, onRemove, fixedSkill = false, allowComplete = false }) {
  const set = (field, value) => onChange({ ...question, [field]: value });
  const complete = question.kind === CourseQuestionKind.COMPLETE;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {allowComplete ? (
          <Select value={question.kind || CourseQuestionKind.CHOICE} onValueChange={(kind) => kind && onChange(withKind(question, kind))}>
            <SelectTrigger className="h-8 w-48" aria-label={`${label} kind`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CourseQuestionKind).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kindLabels[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {fixedSkill ? null : (
          <Select value={question.skill} onValueChange={(skill) => skill && set('skill', skill)}>
            <SelectTrigger className="h-8 w-36" aria-label={`${label} skill`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CourseSkill).map((skill) => (
                <SelectItem key={skill} value={skill}>
                  {skillLabels[skill]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onRemove ? (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" aria-label={`Remove ${label}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Input
        aria-label={`${label} text`}
        placeholder={complete ? `Sentence with ${FILL_IN_BLANK} for each word to write, e.g. Where are you ${FILL_IN_BLANK}?` : 'Question'}
        maxLength={500}
        value={question.prompt}
        onChange={(event) => onChange(withBlankAnswers({ ...question, prompt: event.target.value }))}
      />
      {complete ? (
        <div className="space-y-2">
          {question.answers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Mark each word the learner writes with {FILL_IN_BLANK} (up to {COURSE_LIMITS.completeBlanks}).
            </p>
          ) : null}
          {question.answers.map((answer, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-16 text-sm text-muted-foreground">Blank {index + 1}</span>
              <Input
                aria-label={`${label} blank ${index + 1}`}
                placeholder="Words heard"
                maxLength={100}
                value={answer}
                onChange={(event) =>
                  set(
                    'answers',
                    question.answers.map((item, at) => (at === index ? event.target.value : item)),
                  )
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="sr-only">{label} options</legend>
          {question.options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${id}`}
                className="h-4 w-4 accent-primary"
                aria-label={`Option ${letters[index]} is correct`}
                checked={option.isCorrect}
                onChange={() => onChange(withCorrect(question, option.id))}
              />
              <span className="w-4 text-sm font-medium">{letters[index]}</span>
              <Input
                aria-label={`Option ${letters[index]}`}
                maxLength={300}
                value={option.text}
                onChange={(event) =>
                  set(
                    'options',
                    question.options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item)),
                  )
                }
              />
              {question.options.length > COURSE_LIMITS.options.min ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Remove option ${letters[index]}`}
                  onClick={() =>
                    set(
                      'options',
                      question.options.filter((item) => item.id !== option.id),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {question.options.length < COURSE_LIMITS.options.max ? (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onChange(withOption(question))}>
              <Plus className="h-4 w-4" />
              Add option
            </Button>
          ) : null}
        </fieldset>
      )}
      <TextField
        id={`${id}-explanation`}
        label="Why this answer (shown after answering)"
        value={question.explanation}
        maxLength={1000}
        onChange={(value) => set('explanation', value)}
      />
    </div>
  );
}

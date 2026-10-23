import { Check, Plus, Trash2, X } from 'lucide-react';
import { COURSE_LIMITS, CourseSkill } from '@appenglish/content-contracts';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { withCorrect, withOption } from '../lib/course-draft.js';
import { TextField } from './TextField.jsx';

const letters = ['A', 'B', 'C', 'D'];
const skillLabels = { [CourseSkill.GIST]: 'Main idea', [CourseSkill.DETAIL]: 'Detail', [CourseSkill.INFERENCE]: 'Inference' };

export function CourseQuestionEditor({ id, label, number, question, onChange, onRemove }) {
  const set = (field, value) => onChange({ ...question, [field]: value });
  const answered = question.options.some((option) => option.isCorrect);
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {number ? <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums">{number}</span> : null}
        <span className="font-medium">{label}</span>
        {answered ? null : <Badge variant="outline">No answer</Badge>}
        <Select value={question.skill} onValueChange={(skill) => skill && set('skill', skill)}>
          <SelectTrigger className="ml-auto h-8 w-32" aria-label={`${label} skill`}>
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
        {onRemove ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remove ${label}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Input aria-label={`${label} text`} placeholder="Question" maxLength={500} value={question.prompt} onChange={(event) => set('prompt', event.target.value)} />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Options · pick the correct one</legend>
        {question.options.map((option, index) => (
          <div key={option.id} className={cn('flex items-center gap-2 rounded-lg border p-1.5 transition-colors', option.isCorrect ? 'border-success bg-success/10' : 'bg-background')}>
            <button
              type="button"
              role="radio"
              aria-checked={option.isCorrect}
              aria-label={`Option ${letters[index]} is correct`}
              onClick={() => onChange(withCorrect(question, option.id))}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                option.isCorrect ? 'bg-success text-white' : 'bg-muted hover:bg-accent',
              )}
            >
              {option.isCorrect ? <Check className="h-4 w-4" /> : letters[index]}
            </button>
            <Input
              aria-label={`Option ${letters[index]}`}
              placeholder={`Option ${letters[index]}`}
              maxLength={300}
              className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1"
              value={option.text}
              onChange={(event) => set('options', question.options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item)))}
            />
            {question.options.length > COURSE_LIMITS.options.min ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label={`Remove option ${letters[index]}`}
                onClick={() => set('options', question.options.filter((item) => item.id !== option.id))}
              >
                <X className="h-4 w-4" />
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
      <TextField id={`${id}-explanation`} label="Explanation" value={question.explanation} maxLength={1000} onChange={(value) => set('explanation', value)} />
    </div>
  );
}

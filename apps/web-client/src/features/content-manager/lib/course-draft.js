import { COURSE_LIMITS, CourseItemType, CourseSkill, courseGapCount, courseGapText } from '@appenglish/content-contracts';
import { newSegment } from './listening-draft.js';

const newId = () => crypto.randomUUID();
const newOption = (fields = {}) => ({ id: newId(), text: '', isCorrect: false, ...fields });

export function newQuestion(skill = CourseSkill.DETAIL) {
  return { id: newId(), skill, prompt: '', options: [newOption(), newOption(), newOption()], explanation: '' };
}
export const newWord = () => ({ id: newId(), word: '', phonetic: '', meaning: '', audioMediaId: null });
export const newIdea = () => ({ id: newId(), text: '' });
export const newSection = () => ({ id: newId(), audioMediaId: null, transcript: '', questions: [newQuestion()] });
export const newTopicSegment = (fields = {}) => newSegment({ translation: '', gap: '', ...fields });

export function workingCourse(data) {
  const content = data.draft?.content || data.published?.content || {};
  if (data.item.type !== CourseItemType.TOPIC)
    return { sections: (content.sections || []).map((section) => ({ audioMediaId: null, transcript: '', ...section })) };
  return {
    audioMediaId: content.audioMediaId ?? null,
    segments: (content.segments || []).map((segment) => newTopicSegment(segment)),
    vocabulary: content.vocabulary || [],
    questions: content.questions || [],
    ordering: { enabled: false, prompt: '', items: [], ...(content.ordering || {}) },
  };
}

export const withCorrect = (question, optionId) => ({
  ...question,
  options: question.options.map((option) => ({ ...option, isCorrect: option.id === optionId })),
});

export const withOption = (question) =>
  question.options.length >= COURSE_LIMITS.options.max ? question : { ...question, options: [...question.options, newOption()] };

const same = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function keepSentenceExtras(previous, next, fields = ['translation', 'gap']) {
  const byId = new Map(previous.map((segment) => [segment.id, segment]));
  return next.map((segment, index) => {
    if (fields.every((field) => field in segment)) return segment;
    const before = byId.get(segment.id) || (same(previous[index]?.text) === same(segment.text) ? previous[index] : null);
    return { ...segment, ...Object.fromEntries(fields.map((field) => [field, before?.[field] || ''])) };
  });
}

export function gapProblem(gap, text) {
  if (!gap) return '';
  if (!courseGapCount(gap)) return 'Put [brackets] around the words to write.';
  if (same(courseGapText(gap)) !== same(text)) return 'Keep the words of the sentence; only add [brackets].';
  return '';
}

export const blankCount = (segments) => segments.reduce((sum, segment) => sum + courseGapCount(segment.gap), 0);

export const sectionQuestionCount = (sections) => sections.reduce((sum, section) => sum + section.questions.length, 0);

const fields = {
  prompt: 'question',
  options: 'options',
  phonetic: 'IPA',
  translation: 'translation',
  gap: 'blanks',
  items: 'items',
  text: 'text',
  start: 'times',
  end: 'times',
  transcript: 'transcript',
};

export function courseIssueLabel(path) {
  const whole = { audioMediaId: 'Recording', segments: 'Sentences', vocabulary: 'Vocabulary', questions: 'Questions', sections: 'Level test', 'ordering.items': 'Ordering · items' };
  if (whole[path]) return whole[path];
  const names = { vocabulary: 'Word', questions: 'Question', segments: 'Sentence', sections: 'Recording' };
  const parts = [];
  let within = null;
  for (const match of path.matchAll(/(vocabulary|questions|segments|sections)\[(\d+)\]|\.?(\w+)$/g)) {
    if (match[1]) {
      within = match[1];
      parts.push(`${parts.length ? names[match[1]].toLowerCase() : names[match[1]]} ${Number(match[2]) + 1}`);
    } else if (match[3] === 'audioMediaId') parts.push(within === 'vocabulary' ? 'pronunciation' : 'audio file');
    else if (match[3]) parts.push(fields[match[3]] || match[3]);
  }
  return parts.join(' · ');
}

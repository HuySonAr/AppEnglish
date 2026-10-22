import { COURSE_LIMITS, CourseItemType, CourseSkill, courseGapCount, courseGapText } from '@appenglish/content-contracts';
import { newSegment } from './listening-draft.js';

// The editor of the Listening course (D143–D147): topics (one listening
// lesson each, on the topic's own recording) and level tests. New items get a
// client id, which the server keeps.

const newId = () => crypto.randomUUID();
const newOption = (fields = {}) => ({ id: newId(), text: '', isCorrect: false, ...fields });

export function newQuestion(skill = CourseSkill.DETAIL) {
  return { id: newId(), skill, prompt: '', options: [newOption(), newOption(), newOption()], explanation: '' };
}
export const newWord = () => ({ id: newId(), word: '', phonetic: '', meaning: '', audioMediaId: null });
export const newIdea = () => ({ id: newId(), text: '' });
export const newSection = () => ({ id: newId(), audioMediaId: null, transcript: '', questions: [newQuestion()] });
// A sentence of a topic's recording (D147): text, speaker and times as in the
// listening library, plus its translation and blanks.
export const newTopicSegment = (fields = {}) => newSegment({ translation: '', gap: '', ...fields });

// The content the editor starts from: the draft, else the published version.
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

// The question with its correct option set to optionId.
export const withCorrect = (question, optionId) => ({
  ...question,
  options: question.options.map((option) => ({ ...option, isCorrect: option.id === optionId })),
});

export const withOption = (question) =>
  question.options.length >= COURSE_LIMITS.options.max ? question : { ...question, options: [...question.options, newOption()] };

const same = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// The sentences after a change that may have replaced them (paste, import,
// Transcribe): a new sentence keeps the translation and blanks of the one it
// replaces when it has the same id, or the same words at the same place.
export function keepSentenceExtras(previous, next) {
  const byId = new Map(previous.map((segment) => [segment.id, segment]));
  return next.map((segment, index) => {
    if ('translation' in segment && 'gap' in segment) return segment;
    const before = byId.get(segment.id) || (same(previous[index]?.text) === same(segment.text) ? previous[index] : null);
    return { ...segment, translation: before?.translation || '', gap: before?.gap || '' };
  });
}

// What is wrong with the blanks of a sentence, or '' when nothing (D143):
// brackets must mark words, and removing them must give the sentence back.
export function gapProblem(gap, text) {
  if (!gap) return '';
  if (!courseGapCount(gap)) return 'Put [brackets] around the words to write.';
  if (same(courseGapText(gap)) !== same(text)) return 'Keep the words of the sentence; only add [brackets].';
  return '';
}

// The total number of blanks of a topic.
export const blankCount = (segments) => segments.reduce((sum, segment) => sum + courseGapCount(segment.gap), 0);

// The number of questions of the sections (level test).
export const sectionQuestionCount = (sections) => sections.reduce((sum, section) => sum + section.questions.length, 0);

const fields = {
  prompt: 'question',
  options: 'options',
  phonetic: 'IPA',
  translation: 'translation',
  gap: 'blanks',
  items: 'ideas',
  text: 'text',
  start: 'times',
  end: 'times',
  transcript: 'transcript',
};

// "Word 2 · IPA" for the publish issue path "vocabulary[1].phonetic".
export function courseIssueLabel(path) {
  const whole = { audioMediaId: 'Recording', segments: 'Sentences', vocabulary: 'Vocabulary', questions: 'Questions', sections: 'Level test', 'ordering.items': 'Ordering · ideas' };
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

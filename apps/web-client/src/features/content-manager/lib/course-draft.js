import { COURSE_LEVELS, COURSE_LIMITS, CourseItemType, CourseQuestionKind, CourseSkill, countBlanks } from '@appenglish/content-contracts';

// The editor of the Listening course (F05C, D100, D103): units (lessons and a
// unit check), level tests and the listening placement. New items get a
// client id, which the server keeps.

const newId = () => crypto.randomUUID();
const newOption = (fields = {}) => ({ id: newId(), text: '', isCorrect: false, ...fields });

export function newQuestion(skill = CourseSkill.DETAIL) {
  return { id: newId(), kind: CourseQuestionKind.CHOICE, skill, prompt: '', options: [newOption(), newOption(), newOption()], explanation: '', answers: [] };
}

// The question as a choice or a sentence to complete (D109); a sentence
// keeps one answer per blank of its prompt.
export const withKind = (question, kind) =>
  withBlankAnswers({ ...question, kind, options: kind === CourseQuestionKind.CHOICE && !question.options.length ? newQuestion().options : question.options });

// The answers of a completed sentence or a Focus on passage cut or padded
// to its blanks.
export function withBlankAnswers(item) {
  const blanks = countBlanks(item.kind === CourseQuestionKind.COMPLETE || item.passage !== undefined ? (item.passage ?? item.prompt) : '');
  const answers = (item.answers || []).slice(0, blanks);
  while (answers.length < blanks) answers.push('');
  return { ...item, answers };
}

// Focus on (D109): a dialogue with blanks and the words to fill them from.
export const newFocus = () => ({ title: '', passage: '', words: [], answers: [] });
// The words typed as one line, "going, well, things".
export const focusWordsFromText = (text) => [
  ...new Set(
    text
      .split(/[,\n]/)
      .map((word) => word.trim())
      .filter(Boolean),
  ),
];

export function newLesson() {
  return {
    id: newId(),
    title: '',
    exerciseId: null,
    keywords: [],
    gist: newQuestion(CourseSkill.GIST),
    detail: [newQuestion(), newQuestion()],
    focus: null,
    closeSegmentIds: [],
  };
}

export const newKeyword = () => ({ id: newId(), word: '', meaning: '' });
// A placement recording also has the level it tests.
export const newSection = (level) => ({ id: newId(), exerciseId: null, ...(level !== undefined ? { level } : {}), questions: [newQuestion()] });

// The content the editor starts from: the draft, else the published version.
export function workingCourse(data) {
  const content = data.draft?.content || data.published?.content || {};
  if (data.item.type !== CourseItemType.UNIT) return { sections: content.sections || [] };
  return { lessons: content.lessons || [], check: { sections: content.check?.sections || [] } };
}

// The question with its correct option set to optionId.
export const withCorrect = (question, optionId) => ({
  ...question,
  options: question.options.map((option) => ({ ...option, isCorrect: option.id === optionId })),
});

export const withOption = (question) =>
  question.options.length >= COURSE_LIMITS.options.max ? question : { ...question, options: [...question.options, newOption()] };

// A sentence chosen or unchosen for close listening, at most the limit.
export function toggleClose(lesson, segmentId) {
  const chosen = lesson.closeSegmentIds.includes(segmentId);
  if (!chosen && lesson.closeSegmentIds.length >= COURSE_LIMITS.closeSentences.max) return lesson;
  return {
    ...lesson,
    closeSegmentIds: chosen ? lesson.closeSegmentIds.filter((id) => id !== segmentId) : [...lesson.closeSegmentIds, segmentId],
  };
}

// The number of questions of the sections (unit check, level test).
export const sectionQuestionCount = (sections) => sections.reduce((sum, section) => sum + section.questions.length, 0);

// The placement's questions by level: [{ level, count }], A1 to C1.
export const placementLevelCounts = (sections) =>
  COURSE_LEVELS.map((level) => ({ level, count: sectionQuestionCount(sections.filter((section) => section.level === level)) }));

const fields = {
  level: 'level',
  prompt: 'question',
  options: 'options',
  exerciseId: 'recording',
  closeSegmentIds: 'sentences to write down',
  title: 'title',
  detail: 'detail questions',
  kind: 'kind',
  answers: 'answers',
  passage: 'passage',
  words: 'words',
  questions: 'questions',
};

// "Lesson 2 · detail question 1 · options" for the publish issue path
// "lessons[1].detail[0].options". type names the item for "sections".
export function courseIssueLabel(path, type) {
  const parts = [];
  const pattern = /(lessons|keywords|detail|sections|questions)\[(\d+)\]|(gist|check|focus)|\.?(\w+)$/g;
  const names = { lessons: 'Lesson', keywords: 'keyword', detail: 'detail question', sections: 'Recording', questions: 'question' };
  for (const match of path.matchAll(pattern)) {
    if (match[1]) parts.push(`${names[match[1]]} ${Number(match[2]) + 1}`);
    else if (match[3] === 'gist') parts.push('gist question');
    else if (match[3] === 'focus') parts.push('Focus on');
    else if (match[3] === 'check') parts.push('Unit check');
    else if (match[4] && !['lessons', 'sections'].includes(match[4])) parts.push(fields[match[4]] || match[4]);
  }
  if (path === 'lessons') return 'Lessons';
  if (path === 'sections') return type === CourseItemType.PLACEMENT ? 'Placement' : 'Level test';
  if (path === 'check.sections') return 'Unit check';
  return parts.join(' · ');
}

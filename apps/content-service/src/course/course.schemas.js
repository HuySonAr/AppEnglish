import { z } from 'zod';
import {
  COURSE_LEVELS,
  COURSE_LIMITS,
  COURSE_SECTIONS,
  CourseItemType,
  CourseQuestionKind,
  CourseSkill,
  FILL_IN_BLANK,
  countBlanks,
  hasCourseFocus,
} from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max);
const requiredText = (max) => text(max).min(1);
const id = z.string().uuid().optional();

// The placement has no level of its own (D103); units and level tests need
// one. A unit belongs to a section of its level (D107); nothing else does.
export const courseItemCreateSchema = z
  .object({
    level: z.enum(COURSE_LEVELS).nullable().default(null),
    type: z.enum(Object.values(CourseItemType)),
    section: z.enum(COURSE_SECTIONS).nullable().default(null),
    title: requiredText(200),
    description: text(2000).default(''),
  })
  .strict()
  .refine((value) => (value.type === CourseItemType.PLACEMENT ? value.level === null : value.level !== null), {
    message: 'Choose the level (none for the placement)',
    path: ['level'],
  })
  .refine((value) => (value.type === CourseItemType.UNIT ? value.section !== null : value.section === null), {
    message: 'Choose the section (units only)',
    path: ['section'],
  });

export const courseItemUpdateSchema = z
  .object({
    title: requiredText(200).optional(),
    description: text(2000).optional(),
    section: z.enum(COURSE_SECTIONS).optional(),
    position: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'At least one field is required' });

// A question about a recording (D100): multiple choice, or (detail
// questions only, D109) a sentence with blanks completed with the words heard
// (`answers`, one per blank).
const questionSchema = z
  .object({
    id,
    kind: z.enum(Object.values(CourseQuestionKind)).default(CourseQuestionKind.CHOICE),
    skill: z.enum(Object.values(CourseSkill)).default(CourseSkill.DETAIL),
    prompt: text(500).default(''),
    answers: z.array(text(100)).max(COURSE_LIMITS.completeBlanks).default([]),
    options: z
      .array(
        z
          .object({
            id,
            text: text(300).default(''),
            isCorrect: z.boolean().default(false),
          })
          .strict(),
      )
      .max(COURSE_LIMITS.options.max)
      .default([]),
    explanation: text(1000).default(''),
  })
  .strict();

const keywordSchema = z.object({ id, word: text(100).default(''), meaning: text(300).default('') }).strict();

// Focus on (D109): a short dialogue with blanks filled from the words given.
const focusSchema = z
  .object({
    title: text(200).default(''),
    passage: text(2000).default(''),
    words: z.array(text(100)).max(COURSE_LIMITS.focusWords).default([]),
    answers: z.array(text(100)).max(COURSE_LIMITS.focusBlanks).default([]),
  })
  .strict();

// One lesson: a recording of the library and its five steps.
const lessonSchema = z
  .object({
    id,
    title: text(200).default(''),
    exerciseId: z.string().uuid().nullable().default(null),
    keywords: z.array(keywordSchema).max(COURSE_LIMITS.keywords).default([]),
    gist: questionSchema.default({ skill: CourseSkill.GIST }),
    detail: z.array(questionSchema).max(COURSE_LIMITS.detailQuestions.max).default([]),
    focus: focusSchema.nullable().default(null),
    // Sentences of the recording the learner writes down.
    closeSegmentIds: z.array(z.string().uuid()).max(COURSE_LIMITS.closeSentences.max).default([]),
  })
  .strict();

// A recording of the library with questions about it (unit check, level test).
const sectionSchema = z
  .object({
    id,
    exerciseId: z.string().uuid().nullable().default(null),
    questions: z.array(questionSchema).max(COURSE_LIMITS.questionsPerSection).default([]),
  })
  .strict();

export const unitContentSchema = z
  .object({
    lessons: z.array(lessonSchema).max(COURSE_LIMITS.lessonsPerUnit).default([]),
    check: z
      .object({
        sections: z.array(sectionSchema).max(COURSE_LIMITS.sections).default([]),
      })
      .strict()
      .default({}),
  })
  .strict();

export const levelTestContentSchema = z
  .object({
    sections: z.array(sectionSchema).max(COURSE_LIMITS.sections).default([]),
  })
  .strict();

// The listening placement (D103): recordings of every level, each with the
// level it tests.
export const placementContentSchema = z
  .object({
    sections: z
      .array(
        sectionSchema.extend({
          level: z.enum(COURSE_LEVELS).nullable().default(null),
        }),
      )
      .max(COURSE_LIMITS.sections)
      .default([]),
  })
  .strict();

export const contentSchemaOf = (type) =>
  type === CourseItemType.UNIT ? unitContentSchema : type === CourseItemType.PLACEMENT ? placementContentSchema : levelTestContentSchema;

// The library exercises a content refers to.
export function courseExerciseIds(content) {
  const sections = content.sections || content.check?.sections || [];
  return [...new Set([...(content.lessons || []).map((lesson) => lesson.exerciseId), ...sections.map((section) => section.exerciseId)].filter(Boolean))];
}

// complete: whether a "complete the sentence" question is allowed here
// (detail questions of a lesson only).
function questionIssues(issue, path, question, complete = false) {
  if (!question.prompt) issue(`${path}.prompt`, 'Write the question');
  if (question.kind === CourseQuestionKind.COMPLETE) {
    if (!complete) issue(`${path}.kind`, 'Only detail questions of a lesson can be completed with words heard');
    const blanks = countBlanks(question.prompt);
    if (question.prompt && !blanks) issue(`${path}.prompt`, `Mark each word to write with ${FILL_IN_BLANK}`);
    else if (blanks > COURSE_LIMITS.completeBlanks) issue(`${path}.prompt`, `At most ${COURSE_LIMITS.completeBlanks} blanks`);
    else if (question.answers.length !== blanks)
      issue(
        `${path}.answers`,
        `The sentence has ${blanks} blank${blanks === 1 ? '' : 's'} but ${question.answers.length} answer${question.answers.length === 1 ? '' : 's'}`,
      );
    else if (question.answers.some((answer) => !answer)) issue(`${path}.answers`, 'Every blank needs the words heard');
    return;
  }
  const options = question.options;
  if (options.length < COURSE_LIMITS.options.min) issue(`${path}.options`, `At least ${COURSE_LIMITS.options.min} options are needed`);
  else if (options.some((option) => !option.text)) issue(`${path}.options`, 'Every option needs text');
  else if (new Set(options.map((option) => option.text.toLowerCase())).size !== options.length) issue(`${path}.options`, 'Options must be different');
  if (options.filter((option) => option.isCorrect).length !== 1) issue(`${path}.options`, 'Exactly one option must be correct');
}

// The Focus on step is optional; once it has a passage it needs its blanks,
// an answer for each taken from the words, and distinct words.
function focusIssues(issue, path, focus) {
  if (!hasCourseFocus(focus)) return;
  const blanks = countBlanks(focus.passage);
  if (!blanks) issue(`${path}.passage`, `Mark each blank with ${FILL_IN_BLANK}`);
  else if (blanks > COURSE_LIMITS.focusBlanks) issue(`${path}.passage`, `At most ${COURSE_LIMITS.focusBlanks} blanks`);
  const words = focus.words.map((word) => word.trim()).filter(Boolean);
  if (words.length < 2) issue(`${path}.words`, 'Give at least two words to choose from');
  else if (new Set(words.map((word) => word.toLowerCase())).size !== words.length) issue(`${path}.words`, 'Words must be different');
  if (blanks && focus.answers.length !== blanks)
    issue(
      `${path}.answers`,
      `The passage has ${blanks} blank${blanks === 1 ? '' : 's'} but ${focus.answers.length} answer${focus.answers.length === 1 ? '' : 's'}`,
    );
  else if (focus.answers.some((answer) => !words.includes(answer))) issue(`${path}.answers`, 'Every answer must be one of the words');
}

// exercises maps an exercise id to its published version's sentences
// ({ segments: [{ id }] }); an exercise missing from it is not published.
function sectionIssues(issue, path, sections) {
  return (exercises) => {
    let questions = 0;
    sections.forEach((section, index) => {
      const at = `${path}[${index}]`;
      if (!section.exerciseId) issue(`${at}.exerciseId`, 'Choose a recording');
      else if (!exercises.has(section.exerciseId)) issue(`${at}.exerciseId`, 'The recording is not published');
      if (!section.questions.length) issue(`${at}.questions`, 'Add at least one question');
      section.questions.forEach((question, at2) => questionIssues(issue, `${at}.questions[${at2}]`, question));
      questions += section.questions.length;
    });
    return questions;
  };
}

// Returns the reasons a course item draft cannot be published; empty when it
// can (D100). exercises: Map of published library exercises (see above).
export function courseIssues(type, content, exercises) {
  const issues = [];
  const issue = (path, message) => issues.push({ path, message });
  if (type === CourseItemType.PLACEMENT) {
    if (!content.sections.length) issue('sections', 'Add recordings with questions for every level');
    sectionIssues(issue, 'sections', content.sections)(exercises);
    content.sections.forEach((section, index) => {
      if (!section.level) issue(`sections[${index}].level`, 'Choose the level this recording tests');
    });
    const min = COURSE_LIMITS.placementQuestionsPerLevel;
    for (const level of COURSE_LEVELS) {
      const count = content.sections.filter((section) => section.level === level).reduce((sum, section) => sum + section.questions.length, 0);
      if (count < min) issue('sections', `${level} needs at least ${min} questions; it has ${count}`);
    }
    return issues;
  }
  if (type === CourseItemType.LEVEL_TEST) {
    if (!content.sections.length) issue('sections', 'Add at least one recording with questions');
    const count = sectionIssues(issue, 'sections', content.sections)(exercises);
    if (count < COURSE_LIMITS.levelTestQuestions)
      issue('sections', `A level test needs at least ${COURSE_LIMITS.levelTestQuestions} questions; it has ${count}`);
    return issues;
  }
  if (!content.lessons.length) issue('lessons', 'Add at least one lesson');
  content.lessons.forEach((lesson, index) => {
    const at = `lessons[${index}]`;
    if (!lesson.title) issue(`${at}.title`, 'Give the lesson a title');
    const exercise = lesson.exerciseId ? exercises.get(lesson.exerciseId) : null;
    if (!lesson.exerciseId) issue(`${at}.exerciseId`, 'Choose a recording');
    else if (!exercise) issue(`${at}.exerciseId`, 'The recording is not published');
    lesson.keywords.forEach((keyword, at2) => {
      if (!keyword.word || !keyword.meaning) issue(`${at}.keywords[${at2}]`, 'A keyword needs the word and its meaning');
    });
    questionIssues(issue, `${at}.gist`, lesson.gist);
    const { min, max } = COURSE_LIMITS.detailQuestions;
    if (lesson.detail.length < min || lesson.detail.length > max) issue(`${at}.detail`, `${min} to ${max} detail questions are needed`);
    lesson.detail.forEach((question, at2) => questionIssues(issue, `${at}.detail[${at2}]`, question, true));
    focusIssues(issue, `${at}.focus`, lesson.focus);
    const close = COURSE_LIMITS.closeSentences;
    if (lesson.closeSegmentIds.length < close.min) issue(`${at}.closeSegmentIds`, `Choose ${close.min} to ${close.max} sentences to write down`);
    if (exercise && lesson.closeSegmentIds.some((segmentId) => !exercise.segments.some((segment) => segment.id === segmentId)))
      issue(`${at}.closeSegmentIds`, 'A chosen sentence is no longer in the recording');
  });
  const sections = content.check.sections;
  if (!sections.length) issue('check.sections', 'Add the unit check: at least one recording with questions');
  const count = sectionIssues(issue, 'check.sections', sections)(exercises);
  if (sections.length && count < COURSE_LIMITS.unitCheckQuestions)
    issue('check.sections', `A unit check needs at least ${COURSE_LIMITS.unitCheckQuestions} questions; it has ${count}`);
  return issues;
}

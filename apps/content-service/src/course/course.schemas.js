import { z } from 'zod';
import {
  COURSE_LEVELS,
  COURSE_LIMITS,
  COURSE_TEST_LEVELS,
  CourseItemType,
  CourseSkill,
  LISTENING_MAX_SEGMENTS,
  LISTENING_SEGMENT_MAX_LENGTH,
  MediaKind,
  courseGapCount,
  courseGapText,
} from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max);
const requiredText = (max) => text(max).min(1);
const id = z.string().uuid().optional();

// A topic or a level test of a level (D143–D145); level tests exist for
// every level but the last.
export const courseItemCreateSchema = z
  .object({
    level: z.enum(COURSE_LEVELS),
    type: z.enum(Object.values(CourseItemType)),
    title: requiredText(200),
    description: text(2000).default(''),
  })
  .strict()
  .refine((value) => value.type !== CourseItemType.LEVEL_TEST || COURSE_TEST_LEVELS.includes(value.level), {
    message: 'The last level has no level test',
    path: ['level'],
  });

export const courseItemUpdateSchema = z
  .object({
    title: requiredText(200).optional(),
    description: text(2000).optional(),
    position: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'At least one field is required' });

// A multiple-choice question about a recording.
const questionSchema = z
  .object({
    id,
    skill: z.enum(Object.values(CourseSkill)).default(CourseSkill.DETAIL),
    prompt: text(500).default(''),
    options: z
      .array(z.object({ id, text: text(300).default(''), isCorrect: z.boolean().default(false) }).strict())
      .max(COURSE_LIMITS.options.max)
      .default([]),
    explanation: text(1000).default(''),
  })
  .strict();

// A word to learn before listening (D143): IPA, meaning and a pronunciation
// made by the speech service (D144).
const vocabularySchema = z
  .object({
    id,
    word: text(100).default(''),
    phonetic: text(100).default(''),
    meaning: text(300).default(''),
    audioMediaId: z.string().uuid().nullable().default(null),
  })
  .strict();

// The ideas in the order they are heard; the learner gets them shuffled.
const orderingSchema = z
  .object({
    enabled: z.boolean().default(false),
    prompt: text(300).default(''),
    items: z.array(z.object({ id, text: text(300).default('') }).strict()).max(COURSE_LIMITS.ordering.max).default([]),
  })
  .strict();

// A time in the recording, in seconds.
const seconds = z.number().min(0).max(3 * 60 * 60).nullable().default(null);

// A sentence of a topic's own recording (D147): its text and speaker, its
// place in the recording (Auto-time), the Vietnamese translation, and the
// sentence with the words to write in [brackets] for the blanks mode of the
// dictation ('' = no blank).
const segmentSchema = z
  .object({
    id,
    speaker: text(40).default(''),
    text: text(LISTENING_SEGMENT_MAX_LENGTH).default(''),
    start: seconds,
    end: seconds,
    translation: text(1000).default(''),
    gap: text(600).default(''),
  })
  .strict();

const audioMediaId = z.string().uuid().nullable().default(null);

// One topic: one lesson on its own recording (D144, D147).
export const topicContentSchema = z
  .object({
    audioMediaId,
    segments: z.array(segmentSchema).max(LISTENING_MAX_SEGMENTS).default([]),
    vocabulary: z.array(vocabularySchema).max(COURSE_LIMITS.vocabulary.max).default([]),
    questions: z.array(questionSchema).max(COURSE_LIMITS.questions.max).default([]),
    ordering: orderingSchema.default({}),
  })
  .strict();

// A recording of a level test with its transcript (shown after the test) and
// the questions about it (D147).
const sectionSchema = z
  .object({
    id,
    audioMediaId,
    transcript: text(COURSE_LIMITS.transcript).default(''),
    questions: z.array(questionSchema).max(COURSE_LIMITS.questionsPerSection).default([]),
  })
  .strict();

export const levelTestContentSchema = z
  .object({ sections: z.array(sectionSchema).max(COURSE_LIMITS.sections).default([]) })
  .strict();

export const contentSchemaOf = (type) => (type === CourseItemType.TOPIC ? topicContentSchema : levelTestContentSchema);

// The recordings of a content: the topic's, or each level-test section's.
export const courseAudioIds = (content) => [content.audioMediaId, ...(content.sections || []).map((section) => section.audioMediaId)].filter(Boolean);

// Every media a content refers to: its recordings and the words' pronunciations.
export const courseMediaIds = (content) => [...courseAudioIds(content), ...(content.vocabulary || []).map((item) => item.audioMediaId).filter(Boolean)];

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function questionIssues(issue, path, question) {
  if (!question.prompt) issue(`${path}.prompt`, 'Write the question');
  const options = question.options;
  if (options.length < COURSE_LIMITS.options.min) issue(`${path}.options`, `At least ${COURSE_LIMITS.options.min} options are needed`);
  else if (options.some((option) => !option.text)) issue(`${path}.options`, 'Every option needs text');
  else if (new Set(options.map((option) => option.text.toLowerCase())).size !== options.length) issue(`${path}.options`, 'Options must be different');
  if (options.filter((option) => option.isCorrect).length !== 1) issue(`${path}.options`, 'Exactly one option must be correct');
}

function audioIssues(issue, path, mediaId, mediaById) {
  if (!mediaId) issue(path, 'Add the recording');
  else if (mediaById.get(mediaId)?.kind !== MediaKind.AUDIO) issue(path, 'The recording is missing or is not audio');
}

// mediaById maps existing media ids to their rows.
function topicIssues(issue, content, mediaById) {
  audioIssues(issue, 'audioMediaId', content.audioMediaId, mediaById);

  const { min, max } = COURSE_LIMITS.vocabulary;
  if (content.vocabulary.length < min || content.vocabulary.length > max) issue('vocabulary', `${min} to ${max} words are needed`);
  content.vocabulary.forEach((item, index) => {
    if (!item.word || !item.meaning) issue(`vocabulary[${index}]`, 'A word needs the word and its meaning');
    if (!item.phonetic) issue(`vocabulary[${index}].phonetic`, 'Add the IPA');
    if (!item.audioMediaId) issue(`vocabulary[${index}].audioMediaId`, 'Add the pronunciation');
  });

  if (content.questions.length < COURSE_LIMITS.questions.min) issue('questions', 'Add at least one question');
  content.questions.forEach((question, index) => questionIssues(issue, `questions[${index}]`, question));

  if (content.ordering.enabled) {
    const items = content.ordering.items.map((item) => item.text);
    const { min: least, max: most } = COURSE_LIMITS.ordering;
    if (items.length < least || items.length > most) issue('ordering.items', `${least} to ${most} items are needed`);
    else if (items.some((item) => !item)) issue('ordering.items', 'Every item needs text');
    else if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) issue('ordering.items', 'Items must be different');
  }

  // Every sentence is written down alone, so each needs its place in the
  // recording, and its translation for the transcript.
  if (!content.segments.length) issue('segments', 'Add the transcript of the recording');
  let blanks = 0;
  let previousStart = -1;
  content.segments.forEach((segment, index) => {
    const path = `segments[${index}]`;
    const number = index + 1;
    if (!segment.text) issue(`${path}.text`, `Write sentence ${number}`);
    if (segment.start === null || segment.end === null) issue(`${path}.start`, `Sentence ${number} needs its start and end (Auto-time)`);
    else if (segment.end <= segment.start) issue(`${path}.end`, `The end of sentence ${number} must come after its start`);
    else if (segment.start < previousStart) issue(`${path}.start`, 'Sentences must follow the order of the recording');
    if (segment.start !== null) previousStart = segment.start;
    if (!segment.translation) issue(`${path}.translation`, `Translate sentence ${number}`);
    if (segment.gap) {
      const count = courseGapCount(segment.gap);
      if (!count) issue(`${path}.gap`, `Mark the words to write in sentence ${number} with [brackets], or leave it empty`);
      else if (normalize(courseGapText(segment.gap)) !== normalize(segment.text))
        issue(`${path}.gap`, `Sentence ${number} with its blanks must keep the words of the sentence`);
      blanks += count;
    }
  });
  if (content.segments.length && !blanks) issue('segments', 'Mark at least one word to write for the blanks mode of the dictation');
  const ids = content.segments.map((segment) => segment.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) issue('segments', 'Sentence ids must be unique');
}

// Returns the reasons a course item draft cannot be published; empty when it can.
export function courseIssues(type, content, mediaById) {
  const issues = [];
  const issue = (path, message) => issues.push({ path, message });
  if (type === CourseItemType.TOPIC) {
    topicIssues(issue, content, mediaById);
    return issues;
  }
  if (!content.sections.length) issue('sections', 'Add at least one recording with questions');
  let count = 0;
  content.sections.forEach((section, index) => {
    const at = `sections[${index}]`;
    audioIssues(issue, `${at}.audioMediaId`, section.audioMediaId, mediaById);
    if (!section.transcript) issue(`${at}.transcript`, 'Add the transcript (learners read it after the test)');
    if (!section.questions.length) issue(`${at}.questions`, 'Add at least one question');
    section.questions.forEach((question, at2) => questionIssues(issue, `${at}.questions[${at2}]`, question));
    count += section.questions.length;
  });
  if (count < COURSE_LIMITS.levelTestQuestions) issue('sections', `A level test needs at least ${COURSE_LIMITS.levelTestQuestions} questions; it has ${count}`);
  return issues;
}

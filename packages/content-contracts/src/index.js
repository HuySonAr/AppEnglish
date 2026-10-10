export const UnitStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED'
});

export const LessonVersionStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED'
});

export const Skill = Object.freeze({
  READING: 'READING',
  LISTENING: 'LISTENING'
});

export const MediaKind = Object.freeze({
  AUDIO: 'audio',
  IMAGE: 'image'
});

// Which part of a lesson a file belongs to; decides its storage folder.
export const MediaSection = Object.freeze({ VOCABULARY: 'vocabulary', TEST: 'test' });

export const Accent = Object.freeze({ UK: 'uk', US: 'us' });

export const PartOfSpeech = Object.freeze({
  NOUN: 'noun',
  VERB: 'verb',
  ADJECTIVE: 'adjective',
  ADVERB: 'adverb',
  PREPOSITION: 'preposition',
  CONJUNCTION: 'conjunction',
  PRONOUN: 'pronoun',
  DETERMINER: 'determiner',
  INTERJECTION: 'interjection',
  PHRASE: 'phrase'
});

// Marks a blank in the fill-in passage and in the Part 6 passage.
export const FILL_IN_BLANK = '___';

export function countBlanks(text) {
  return (text || '').split(FILL_IN_BLANK).length - 1;
}

// The lesson test always has these seven parts (D45). For each part:
// questionCount/optionCount are fixed; group, question and option list the
// fields that part uses. Audio always comes with a transcript. Parts 1 and 2
// play one recording for the whole part (D48): it reads the questions and
// the lettered options, so their options are letters only. Questions are
// numbered 1-23 across the parts: firstQuestionNumber is a part's first one.
let nextQuestionNumber = 1;
export const LESSON_TEST_PARTS = Object.freeze([
  { key: 'part1', number: 1, skill: Skill.LISTENING, title: 'Photographs', questionCount: 1, optionCount: 4, group: { audio: true }, question: { image: true }, option: {} },
  { key: 'part2', number: 2, skill: Skill.LISTENING, title: 'Question-Response', questionCount: 2, optionCount: 3, group: { audio: true }, question: {}, option: {} },
  { key: 'part3', number: 3, skill: Skill.LISTENING, title: 'Conversation', questionCount: 3, optionCount: 4, group: { audio: true }, question: { prompt: true }, option: { text: true } },
  { key: 'part4', number: 4, skill: Skill.LISTENING, title: 'Talk', questionCount: 3, optionCount: 4, group: { audio: true }, question: { prompt: true }, option: { text: true } },
  { key: 'part5', number: 5, skill: Skill.READING, title: 'Incomplete Sentences', questionCount: 6, optionCount: 4, group: {}, question: { prompt: true }, option: { text: true } },
  { key: 'part6', number: 6, skill: Skill.READING, title: 'Text Completion', questionCount: 3, optionCount: 4, group: { passage: true, blanks: true }, question: {}, option: { text: true } },
  { key: 'part7', number: 7, skill: Skill.READING, title: 'Reading Comprehension', questionCount: 5, optionCount: 4, group: { passage: true, optionalImage: true }, question: { prompt: true }, option: { text: true } }
].map((part) => {
  const firstQuestionNumber = nextQuestionNumber;
  nextQuestionNumber += part.questionCount;
  return Object.freeze({ ...part, firstQuestionNumber });
}));

export const LESSON_TEST_QUESTION_COUNT = LESSON_TEST_PARTS.reduce(
  (total, part) => total + part.questionCount,
  0
);

// A unit needs this many published lessons before it can be published (D04).
export const MIN_PUBLISHED_LESSONS_PER_UNIT = 5;

// Content codes share the numeric space of @appenglish/auth-contracts
// ResponseCode: 0/1 success, 21 session expired, 26 forbidden role,
// 30 validation and 32 system error keep their meaning; 40-49 are content.
export const ContentResponseCode = Object.freeze({
  SUCCESS: 0,
  FORBIDDEN_ROLE: 26,
  VALIDATION_ERROR: 30,
  SYSTEM_ERROR: 32,
  CONTENT_NOT_FOUND: 40,
  CONTENT_INVALID_STATE: 41,
  CONTENT_NOT_PUBLISHABLE: 42,
  MEDIA_INVALID: 43,
  PRONUNCIATION_UNAVAILABLE: 44
});

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
export const MediaSection = Object.freeze({
  VOCABULARY: 'vocabulary',
  TEST: 'test',
  PLACEMENT: 'placement',
  MOCK: 'mock'
});

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

// Mock tests (F05A) use the same seven parts with the question counts of a
// full TOEIC test (200 questions, 120 minutes). A mock test may hold fewer
// questions; these are the counts the editor aims for. Audio in a mock test
// (D66): Parts 1 and 2 have one recording per question; Parts 3 and 4 are made
// of sets, one recording (a conversation or a talk) with its questions,
// usually three. Parts 6 and 7 are made of sets too: one passage with its
// questions.
export const MOCK_TEST_PART_COUNTS = Object.freeze({
  part1: 6,
  part2: 25,
  part3: 39,
  part4: 30,
  part5: 30,
  part6: 16,
  part7: 54
});
export const MOCK_TEST_DURATION_MINUTES = 120;

// How the tests of an exam type are written and taken (D69). An exam type
// without a format has no editor yet, so no test can be created for it.
export const ExamFormat = Object.freeze({ TOEIC: 'toeic' });
export const MOCK_TEST_LEVELS = Object.freeze([1, 2, 3]);
// Parts whose questions belong to sets (`groups`) in a mock test, and what a
// set holds: a recording or a passage.
export const MOCK_GROUPED_PARTS = Object.freeze(['part3', 'part4', 'part6', 'part7']);
export const MOCK_GROUP_AUDIO_PARTS = Object.freeze(['part3', 'part4']);
// Questions of one conversation (Part 3) or talk (Part 4); a set cannot hold
// more, and a part cannot hold more than its MOCK_TEST_PART_COUNTS (D72).
export const MOCK_SET_QUESTION_COUNT = 3;
// The sets of Parts 3 and 4 that come with a graphic (0-based: conversations
// 11-13 and talks 9-10 of a full test). One question of such a set, usually
// the middle one, is the "Look at the graphic" question and holds the image.
export const MOCK_GRAPHIC_SET_INDEXES = Object.freeze({
  part3: Object.freeze([10, 11, 12]),
  part4: Object.freeze([8, 9])
});
// Parts where each question has its own recording in a mock test.
export const MOCK_QUESTION_AUDIO_PARTS = Object.freeze(['part1', 'part2']);

export const LESSON_TEST_QUESTION_COUNT = LESSON_TEST_PARTS.reduce(
  (total, part) => total + part.questionCount,
  0
);

// A unit needs this many published lessons before it can be published (D55).
export const MIN_PUBLISHED_LESSONS_PER_UNIT = 1;

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
  PRONUNCIATION_UNAVAILABLE: 44,
  EXAM_TYPE_INVALID: 45
});

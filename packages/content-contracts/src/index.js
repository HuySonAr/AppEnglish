export const UnitStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
});

export const LessonVersionStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
});

export const Skill = Object.freeze({
  READING: 'READING',
  LISTENING: 'LISTENING',
});

export const MediaKind = Object.freeze({
  AUDIO: 'audio',
  IMAGE: 'image',
});

export const MediaSection = Object.freeze({
  VOCABULARY: 'vocabulary',
  TEST: 'test',
  PLACEMENT: 'placement',
  MOCK: 'mock',
  LISTENING: 'listening',
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
  PHRASE: 'phrase',
});

export const FILL_IN_BLANK = '___';

export function countBlanks(text) {
  return (text || '').split(FILL_IN_BLANK).length - 1;
}

let nextQuestionNumber = 1;
export const LESSON_TEST_PARTS = Object.freeze(
  [
    {
      key: 'part1',
      number: 1,
      skill: Skill.LISTENING,
      title: 'Photographs',
      questionCount: 1,
      optionCount: 4,
      group: { audio: true },
      question: { image: true },
      option: {},
    },
    {
      key: 'part2',
      number: 2,
      skill: Skill.LISTENING,
      title: 'Question-Response',
      questionCount: 2,
      optionCount: 3,
      group: { audio: true },
      question: {},
      option: {},
    },
    {
      key: 'part3',
      number: 3,
      skill: Skill.LISTENING,
      title: 'Conversation',
      questionCount: 3,
      optionCount: 4,
      group: { audio: true },
      question: { prompt: true },
      option: { text: true },
    },
    {
      key: 'part4',
      number: 4,
      skill: Skill.LISTENING,
      title: 'Talk',
      questionCount: 3,
      optionCount: 4,
      group: { audio: true },
      question: { prompt: true },
      option: { text: true },
    },
    {
      key: 'part5',
      number: 5,
      skill: Skill.READING,
      title: 'Incomplete Sentences',
      questionCount: 6,
      optionCount: 4,
      group: {},
      question: { prompt: true },
      option: { text: true },
    },
    {
      key: 'part6',
      number: 6,
      skill: Skill.READING,
      title: 'Text Completion',
      questionCount: 3,
      optionCount: 4,
      group: { passage: true, blanks: true },
      question: {},
      option: { text: true },
    },
    {
      key: 'part7',
      number: 7,
      skill: Skill.READING,
      title: 'Reading Comprehension',
      questionCount: 5,
      optionCount: 4,
      group: { passage: true, optionalImage: true },
      question: { prompt: true },
      option: { text: true },
    },
  ].map((part) => {
    const firstQuestionNumber = nextQuestionNumber;
    nextQuestionNumber += part.questionCount;
    return Object.freeze({ ...part, firstQuestionNumber });
  }),
);

export const MOCK_TEST_PART_COUNTS = Object.freeze({
  part1: 6,
  part2: 25,
  part3: 39,
  part4: 30,
  part5: 30,
  part6: 16,
  part7: 54,
});
export const MOCK_TEST_DURATION_MINUTES = 120;

export const ExamFormat = Object.freeze({ TOEIC: 'toeic' });
export const MOCK_TEST_LEVELS = Object.freeze([1, 2, 3]);
export const MOCK_GROUPED_PARTS = Object.freeze(['part3', 'part4', 'part6', 'part7']);
export const MOCK_GROUP_AUDIO_PARTS = Object.freeze(['part3', 'part4']);
export const MOCK_SET_QUESTION_COUNT = 3;
export const MOCK_GRAPHIC_SET_INDEXES = Object.freeze({
  part3: Object.freeze([10, 11, 12]),
  part4: Object.freeze([8, 9]),
});
export const MOCK_QUESTION_AUDIO_PARTS = Object.freeze(['part1', 'part2']);

export const UNIT_REVIEW_PARTS = Object.freeze(['part5', 'part6']);
export const UNIT_REVIEW_PART_COUNTS = Object.freeze({ part5: 10, part6: 9 });
export const UNIT_REVIEW_PASSAGE_COUNT = 3;
export const UNIT_REVIEW_PASSAGE_QUESTIONS = 3;
export const UNIT_REVIEW_QUESTION_COUNT = UNIT_REVIEW_PART_COUNTS.part5 + UNIT_REVIEW_PART_COUNTS.part6;

export const LISTENING_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const ListeningFormat = Object.freeze({ TOEIC: 'toeic', SONG: 'song', TALKS: 'talks' });
export const LISTENING_TOEIC_KINDS = Object.freeze(
  [
    { key: 'part1', number: 1, title: 'Photographs', segmentCount: 4, timed: false, labels: ['(A)', '(B)', '(C)', '(D)'] },
    { key: 'part2', number: 2, title: 'Question-Response', segmentCount: 4, timed: false, labels: ['Question', '(A)', '(B)', '(C)'] },
    { key: 'part3', number: 3, title: 'Conversation', segmentCount: null, timed: true, labels: null, speakers: true },
    { key: 'part4', number: 4, title: 'Talk', segmentCount: null, timed: true, labels: null },
  ].map((kind) => Object.freeze(kind)),
);
export const LISTENING_SONG_KIND = Object.freeze({ key: 'song', number: null, title: 'Song', segmentCount: null, timed: true, labels: null });
export const LISTENING_TALK_KINDS = Object.freeze(
  [
    { key: 'conversation', number: null, title: 'Conversation', segmentCount: null, timed: true, labels: null, speakers: true },
    { key: 'talk', number: null, title: 'Talk', segmentCount: null, timed: true, labels: null },
  ].map((kind) => Object.freeze(kind)),
);
export const LISTENING_KINDS = Object.freeze({
  [ListeningFormat.TOEIC]: LISTENING_TOEIC_KINDS,
  [ListeningFormat.SONG]: Object.freeze([LISTENING_SONG_KIND]),
  [ListeningFormat.TALKS]: LISTENING_TALK_KINDS,
});
export const listeningKind = (key) =>
  Object.values(LISTENING_KINDS)
    .flat()
    .find((kind) => kind.key === key) || null;

const BLANK = /\[([^[\]]*)\]/g;
export function lyricPieces(line) {
  const pieces = [];
  let last = 0;
  for (const match of line.matchAll(BLANK)) {
    if (match.index > last) pieces.push({ text: line.slice(last, match.index) });
    pieces.push({ blank: match[1].trim() });
    last = match.index + match[0].length;
  }
  if (last < line.length) pieces.push({ text: line.slice(last) });
  return pieces;
}
export const lyricText = (line) => line.replace(BLANK, (_, word) => word.trim());
export const lyricBlankCount = (line) => lyricPieces(line).filter((piece) => 'blank' in piece).length;

export const SpeechQueue = Object.freeze({
  AUTOTIME_REQUESTS: 'speech.autotime.requests',
  AUTOTIME_RESULTS: 'speech.autotime.results',
  PRONOUNCE_REQUESTS: 'speech.pronounce.requests',
});
export const SpeechTask = Object.freeze({ ALIGN: 'align', TRANSCRIBE: 'transcribe' });
export const AutoTimeStatus = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  FAILED: 'FAILED',
});

export const LISTENING_MAX_SEGMENTS = 80;
export const LISTENING_SEGMENT_MAX_LENGTH = 500;

export const COURSE_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const COURSE_TEST_LEVELS = Object.freeze(COURSE_LEVELS.slice(0, -1));
export const CourseItemType = Object.freeze({ TOPIC: 'topic', LEVEL_TEST: 'level_test' });
export const CourseSkill = Object.freeze({ GIST: 'gist', DETAIL: 'detail', INFERENCE: 'inference' });
export const COURSE_PASS_PERCENT = Object.freeze({ levelTest: 70 });
export const COURSE_LIMITS = Object.freeze({
  vocabulary: Object.freeze({ min: 4, max: 6 }),
  questions: Object.freeze({ min: 1, max: 10 }),
  options: Object.freeze({ min: 2, max: 4 }),
  ordering: Object.freeze({ min: 3, max: 8 }),
  sections: 12,
  questionsPerSection: 10,
  levelTestQuestions: 8,
  transcript: 10000,
  testPlays: 2,
});
export const courseGapText = (gap) => String(gap || '').replace(/\[([^\[\]]*)\]/g, '$1');
export const courseGapCount = (gap) => (String(gap || '').match(/\[[^\[\]]*\]/g) || []).length;
export const COURSE_RECORDING_KIND = 'part3';

export const LESSON_TEST_QUESTION_COUNT = LESSON_TEST_PARTS.reduce((total, part) => total + part.questionCount, 0);

export const MEDIA_MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;

export const MIN_PUBLISHED_LESSONS_PER_UNIT = 1;

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
  EXAM_TYPE_INVALID: 45,
  LISTENING_TOPIC_INVALID: 46,
  SPEECH_UNAVAILABLE: 47,
  CONTENT_IN_USE: 48,
});

export const ContentUsageKind = Object.freeze({
  UNIT: 'unit',
  LESSON_VERSION: 'lessonVersion',
  MOCK_VERSION: 'mockVersion',
  UNIT_REVIEW_VERSION: 'unitReviewVersion',
  COURSE_VERSION: 'courseVersion',
  LISTENING_VERSION: 'listeningVersion',
  LESSON: 'lesson',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  COURSE_TOPIC: 'courseTopic',
  COURSE_TEST: 'courseTest'
});

export const ORPHAN_MEDIA_GRACE_MS = 60 * 60 * 1000;

export const ContentVersionKind = Object.freeze({
  LESSON: 'lesson',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  COURSE_ITEM: 'courseItem',
  UNIT_REVIEW: 'unitReview',
});

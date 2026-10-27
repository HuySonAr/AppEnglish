export const UnitStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
});

export const LessonVersionStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  RETURNED: 'RETURNED',
  PUBLISHED: 'PUBLISHED',
});

export const WORKING_VERSION_STATUSES = Object.freeze([LessonVersionStatus.DRAFT, LessonVersionStatus.PENDING_REVIEW, LessonVersionStatus.RETURNED]);

export const ContentReviewKind = Object.freeze({
  LESSON: 'lesson',
  UNIT_REVIEW: 'unitReview',
  PLACEMENT: 'placement',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  SW_TEST: 'swTest',
});

export const PLACEMENT_REVIEW_ID = 'main';
export const CONTENT_REVIEW_NOTE_MAX = 1000;

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
  PRACTICE: 'practice',
});

export const PracticePromptKind = Object.freeze({ READ_ALOUD: 'read_aloud', OPEN_SPEAKING: 'open_speaking', WRITING: 'writing' });
export const PracticePromptStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  RETURNED: 'RETURNED',
  ARCHIVED: 'ARCHIVED',
  UNPUBLISHED: 'UNPUBLISHED',
});
export const WritingTaskType = Object.freeze({ SENTENCE: 'sentence', EMAIL: 'email', PARAGRAPH: 'paragraph', ESSAY: 'essay' });
export const CEFR_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const PRACTICE_LIMITS = Object.freeze({
  title: 120,
  topic: 60,
  readAloudText: 500,
  instructions: 1500,
  sampleAnswer: 4000,
  keyPoints: 10,
  keyPoint: 200,
  reviewNote: 1000,
  readAloudSeconds: 45,
  speakingSeconds: Object.freeze({ min: 15, max: 120 }),
  words: Object.freeze({ min: 1, max: 600 }),
  context: 1500,
  info: 3000,
  question: 300,
  keywords: 2,
  keyword: 40,
  email: 3000,
});

export const EtsSpeakingTask = Object.freeze({
  READ_ALOUD: 'read_aloud',
  DESCRIBE_PICTURE: 'describe_picture',
  RESPOND_QUESTIONS: 'respond_questions',
  RESPOND_INFO: 'respond_info',
  EXPRESS_OPINION: 'express_opinion',
});
export const EtsWritingTask = Object.freeze({ PICTURE_SENTENCE: 'picture_sentence', RESPOND_EMAIL: 'respond_email', OPINION_ESSAY: 'opinion_essay' });
export const SwSection = Object.freeze({ SPEAKING: 'speaking', WRITING: 'writing' });
export const SW_SPEAKING_LAYOUT = Object.freeze({ readAloud: 2, pictures: 2, setQuestions: 3, opinion: 1, total: 11 });
export const SW_WRITING_LAYOUT = Object.freeze({ pictureSentences: 5, emails: 2, essay: 1, total: 8 });
export const SW_WRITING_GROUPS = Object.freeze([Object.freeze([1, 2, 3, 4, 5]), Object.freeze([6]), Object.freeze([7]), Object.freeze([8])]);
export const SW_SECTION_MAX_MINUTES = Object.freeze({ speaking: 30, writing: 70 });
export const ETS_SET_TASKS = Object.freeze([EtsSpeakingTask.RESPOND_QUESTIONS, EtsSpeakingTask.RESPOND_INFO]);
export const ETS_SET_QUESTIONS = 3;
export const ETS_TASK_TIMING = Object.freeze({
  [EtsSpeakingTask.READ_ALOUD]: Object.freeze({ prepareSeconds: 45, respondSeconds: Object.freeze([45]) }),
  [EtsSpeakingTask.DESCRIBE_PICTURE]: Object.freeze({ prepareSeconds: 45, respondSeconds: Object.freeze([30]) }),
  [EtsSpeakingTask.RESPOND_QUESTIONS]: Object.freeze({ prepareSeconds: 3, respondSeconds: Object.freeze([15, 15, 30]) }),
  [EtsSpeakingTask.RESPOND_INFO]: Object.freeze({ readSeconds: 45, prepareSeconds: 3, respondSeconds: Object.freeze([15, 15, 30]), playTwice: Object.freeze([2]) }),
  [EtsSpeakingTask.EXPRESS_OPINION]: Object.freeze({ prepareSeconds: 45, respondSeconds: Object.freeze([60]) }),
  [EtsWritingTask.PICTURE_SENTENCE]: Object.freeze({ writeSeconds: 96 }),
  [EtsWritingTask.RESPOND_EMAIL]: Object.freeze({ writeSeconds: 600 }),
  [EtsWritingTask.OPINION_ESSAY]: Object.freeze({ writeSeconds: 1800, recommendedWords: 300 }),
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
export const MockFormat = Object.freeze({ FULL: 'full', PRACTICE: 'practice' });
export const MOCK_FULL_GROUPS = Object.freeze({
  part3: Object.freeze({ groups: 13, questions: 3 }),
  part4: Object.freeze({ groups: 10, questions: 3 }),
  part6: Object.freeze({ groups: 4, questions: 4 }),
});
export const MOCK_FULL_PART7 = Object.freeze({ singles: 10, singleMin: 2, singleMax: 4, singleQuestions: 29, sets: 5, setQuestions: 5 });
export const MOCK_READING_MINUTES = 75;
export const MOCK_LISTENING_MAX_MINUTES = 60;
export const MOCK_ANSWER_SECONDS = Object.freeze({ part1: 5, part2: 5, part3: 8, part4: 8 });
export const TOEIC_SECTION_SEM = 25;
export const TOEIC_SECTION_SEDIFF = 35;

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
  LISTENING_VERSION: 'listeningVersion',
  LESSON: 'lesson',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  SW_TEST: 'swTest',
  SW_TEST_VERSION: 'swTestVersion'
});

export const ORPHAN_MEDIA_GRACE_MS = 60 * 60 * 1000;

export const ContentVersionKind = Object.freeze({
  LESSON: 'lesson',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  UNIT_REVIEW: 'unitReview',
  SW_TEST: 'swTest',
});

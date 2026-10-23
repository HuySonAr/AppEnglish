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

// Which part of a lesson a file belongs to; decides its storage folder.
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
  part7: 54,
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
  part4: Object.freeze([8, 9]),
});
// Parts where each question has its own recording in a mock test.
export const MOCK_QUESTION_AUDIO_PARTS = Object.freeze(['part1', 'part2']);

// Unit review (D121, sizes corrected in D129): the test that closes a unit,
// written by a Content Manager like the Word Review of the book. Reading
// only, no media: 10 Part 5 sentences (questions 1-10) and 3 Part 6 passages
// of 3 blanks each (questions 11-19). It uses the mock-test shape of those
// two parts (passages are sets).
export const UNIT_REVIEW_PARTS = Object.freeze(['part5', 'part6']);
export const UNIT_REVIEW_PART_COUNTS = Object.freeze({ part5: 10, part6: 9 });
export const UNIT_REVIEW_PASSAGE_COUNT = 3;
export const UNIT_REVIEW_PASSAGE_QUESTIONS = 3;
export const UNIT_REVIEW_QUESTION_COUNT = UNIT_REVIEW_PART_COUNTS.part5 + UNIT_REVIEW_PART_COUNTS.part6;

// Listening practice (F05B-2, D85): exercises written by a Content Manager,
// each with a topic, a level and one recording whose transcript is split into
// segments the learner writes down. Levels are CEFR labels of the exercise
// only (D85); nothing else in the app uses them.
export const LISTENING_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
// How the exercises of a topic are written: TOEIC parts or songs (D88). A
// topic without a format has no editor yet, like an exam type (D69).
export const ListeningFormat = Object.freeze({ TOEIC: 'toeic', SONG: 'song', TALKS: 'talks' });
// The kinds of TOEIC dictation. segmentCount is fixed for Parts 1 and 2
// (four statements; a question and three responses); timed: every segment of
// Parts 3 and 4 needs its start and end in the recording.
export const LISTENING_TOEIC_KINDS = Object.freeze(
  [
    { key: 'part1', number: 1, title: 'Photographs', segmentCount: 4, timed: false, labels: ['(A)', '(B)', '(C)', '(D)'] },
    { key: 'part2', number: 2, title: 'Question-Response', segmentCount: 4, timed: false, labels: ['Question', '(A)', '(B)', '(C)'] },
    { key: 'part3', number: 3, title: 'Conversation', segmentCount: null, timed: true, labels: null, speakers: true },
    { key: 'part4', number: 4, title: 'Talk', segmentCount: null, timed: true, labels: null },
  ].map((kind) => Object.freeze(kind)),
);
// A song (F05B-4, D88): the lyrics line by line, every line timed. Words in
// square brackets are the blanks of the fill-in mode.
export const LISTENING_SONG_KIND = Object.freeze({ key: 'song', number: null, title: 'Song', segmentCount: null, timed: true, labels: null });
// Talks and news (D155): recordings such as VOA Learning English, written
// down sentence by sentence, every sentence timed.
export const LISTENING_TALK_KINDS = Object.freeze(
  [
    { key: 'conversation', number: null, title: 'Conversation', segmentCount: null, timed: true, labels: null, speakers: true },
    { key: 'talk', number: null, title: 'Talk', segmentCount: null, timed: true, labels: null },
  ].map((kind) => Object.freeze(kind)),
);
// The kinds of exercise each format has.
export const LISTENING_KINDS = Object.freeze({
  [ListeningFormat.TOEIC]: LISTENING_TOEIC_KINDS,
  [ListeningFormat.SONG]: Object.freeze([LISTENING_SONG_KIND]),
  [ListeningFormat.TALKS]: LISTENING_TALK_KINDS,
});
export const listeningKind = (key) =>
  Object.values(LISTENING_KINDS)
    .flat()
    .find((kind) => kind.key === key) || null;

// A line of lyrics as pieces: { text } as sung, and { blank } for a word in
// square brackets, blank being the word ("I [walked] home" → text "I ",
// blank "walked", text " home"). Brackets without a closing one stay text.
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
// The line as sung, without the brackets.
export const lyricText = (line) => line.replace(BLANK, (_, word) => word.trim());
export const lyricBlankCount = (line) => lyricPieces(line).filter((piece) => 'blank' in piece).length;

// Speech jobs over RabbitMQ between content-service and speech-service. A
// request is { jobId, task, audioUrl, language, kind, lines }:
//   task "align" (Auto-time, D97): lines [{ id, text }] to find in the
//     recording; the answer's lines are [{ id, start, end, matched }],
//     matched being the share (0-1) of the line's words heard;
//   task "transcribe" (D98): no lines; the answer's lines are the text heard
//     [{ text, start, end }], cut as song lines when kind is "song".
// An answer is { jobId, status: RUNNING | DONE | FAILED, lines?, error? }.
export const SpeechQueue = Object.freeze({
  AUTOTIME_REQUESTS: 'speech.autotime.requests',
  AUTOTIME_RESULTS: 'speech.autotime.results',
  // Pronunciation (D123): a request names its reply queue; the answer comes
  // back there with the request's correlation id.
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

// Listening course (F05C, D143–D145): levels A1 to C2, each with topics in
// order; a topic is one listening lesson on its own recording (uploaded in the
// topic with its transcript, timed by Auto-time; D147) with vocabulary, comprehension questions,
// an optional ordering task, dictation (blanks or full sentences, checked but
// not scored) and the transcript with its Vietnamese translation. Nothing in
// a level is locked; the level test of a level, passed, opens the next level.
export const COURSE_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
// The levels that have a level test: every level but the last (D145).
export const COURSE_TEST_LEVELS = Object.freeze(COURSE_LEVELS.slice(0, -1));
export const CourseItemType = Object.freeze({ TOPIC: 'topic', LEVEL_TEST: 'level_test' });
// What a question checks: the main idea, a detail, or what is meant.
export const CourseSkill = Object.freeze({ GIST: 'gist', DETAIL: 'detail', INFERENCE: 'inference' });
// Pass mark (percent) of a level test.
export const COURSE_PASS_PERCENT = Object.freeze({ levelTest: 70 });
export const COURSE_LIMITS = Object.freeze({
  // A topic's words to learn first (D143): the ones the recording needs.
  vocabulary: Object.freeze({ min: 4, max: 6 }),
  questions: Object.freeze({ min: 1, max: 10 }),
  options: Object.freeze({ min: 2, max: 4 }),
  // The ideas to put in the order they are heard (D143), when turned on.
  ordering: Object.freeze({ min: 3, max: 8 }),
  sections: 12,
  questionsPerSection: 10,
  levelTestQuestions: 8,
  // The transcript of a level-test recording (D147), shown after the test.
  transcript: 10000,
  // D141: in a level test a recording is heard at its own speed and at most
  // this many times, as in an exam.
  testPlays: 2,
});
// A sentence of a topic's dictation in the blanks mode (D143): its text with
// the words to write in square brackets, as for songs ("I [walked] home").
// The text without the brackets must be the sentence itself.
export const courseGapText = (gap) => String(gap || '').replace(/\[([^\[\]]*)\]/g, '$1');
export const courseGapCount = (gap) => (String(gap || '').match(/\[[^\[\]]*\]/g) || []).length;
// A topic's recording is cut like a TOEIC conversation (D147): sentences with
// an optional speaker, each timed. Auto-time is sent this kind.
export const COURSE_RECORDING_KIND = 'part3';

export const LESSON_TEST_QUESTION_COUNT = LESSON_TEST_PARTS.reduce((total, part) => total + part.questionCount, 0);

// The upload limit of one media file as the editor states it (D125): the
// default of content-service (a mock-test part can be one long recording);
// MEDIA_MAX_FILE_SIZE_BYTES in .env may lower what the service accepts.
export const MEDIA_MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;

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
  EXAM_TYPE_INVALID: 45,
  LISTENING_TOPIC_INVALID: 46,
  SPEECH_UNAVAILABLE: 47,
  // Learners already have results for it (D118): unpublish instead of deleting.
  CONTENT_IN_USE: 48,
});

// What learner results can refer to (D118); learning-service counts them so
// the gateway refuses to delete content that was used.
export const ContentUsageKind = Object.freeze({
  // A unit itself: the attempts at its review (D121).
  UNIT: 'unit',
  // One stored version (D128): the attempts that were taken on it and are
  // reviewed against it. A listening exercise version is never referenced.
  LESSON_VERSION: 'lessonVersion',
  MOCK_VERSION: 'mockVersion',
  UNIT_REVIEW_VERSION: 'unitReviewVersion',
  COURSE_VERSION: 'courseVersion',
  LISTENING_VERSION: 'listeningVersion',
  LESSON: 'lesson',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  // A topic of the Listening course (D145): the learners who completed it.
  COURSE_TOPIC: 'courseTopic',
  COURSE_TEST: 'courseTest'
});

// A media file uploaded but referenced by no version is left alone this long,
// so an editor still saving is not swept.
export const ORPHAN_MEDIA_GRACE_MS = 60 * 60 * 1000;

// Versioned content whose history a Content Manager can browse and restore
// (D122): the owner id is the lesson, mock test, exercise, course item or
// unit; versions are listed newest first.
export const ContentVersionKind = Object.freeze({
  LESSON: 'lesson',
  MOCK_TEST: 'mockTest',
  LISTENING_EXERCISE: 'listeningExercise',
  COURSE_ITEM: 'courseItem',
  UNIT_REVIEW: 'unitReview',
});

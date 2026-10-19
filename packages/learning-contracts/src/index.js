// Where a learner stands with the placement test. NOT_STARTED has no stored
// attempt; the other three are stored.
export const PlacementStatus = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
});

// Time allowed for the placement test; the server keeps the clock (D57).
export const PLACEMENT_DURATION_MINUTES = 25;

// Minimum score (percent) to start at unit 2 and at unit 3 (D35). An Admin
// can change them.
export const DEFAULT_PLACEMENT_THRESHOLDS = Object.freeze({
  unit2Threshold: 60,
  unit3Threshold: 80,
});

// The unit a learner starts at for correctCount right answers out of
// totalCount. Compares exact fractions, so 59.9% stays below a 60 threshold.
// The result never exceeds the number of published units.
export function placementStartUnit(correctCount, totalCount, thresholds, publishedUnitCount) {
  const reaches = (threshold) => totalCount > 0 && correctCount * 100 >= threshold * totalCount;
  const unit = reaches(thresholds.unit3Threshold) ? 3 : reaches(thresholds.unit2Threshold) ? 2 : 1;
  return Math.max(1, Math.min(unit, publishedUnitCount));
}

// Lesson flow (F04). A lesson is LOCKED until the one before it is completed
// (lessons of units before the starting unit are open freely), OPEN while the
// learner works on it and COMPLETED once the lesson test is passed.
export const LessonState = Object.freeze({
  LOCKED: 'LOCKED',
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
});

// The steps of a lesson, in order. REVIEW (vocabulary of the previous lesson)
// is only part of a lesson when it is required.
export const LessonStep = Object.freeze({
  REVIEW: 'review',
  VOCABULARY: 'vocabulary',
  VOCABULARY_QUIZ: 'quiz',
  FILL_IN: 'fillIn',
  TEST: 'test',
});

export const StepStatus = Object.freeze({ DONE: 'DONE', CURRENT: 'CURRENT', LOCKED: 'LOCKED' });

// The two vocabulary quizzes: this lesson's words, or the previous lesson's.
export const QuizKind = Object.freeze({ VOCABULARY: 'vocabulary', REVIEW: 'review' });

export const LessonTestStatus = Object.freeze({
  LOCKED: 'LOCKED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
});

// How the latest lesson-test attempt compares with the one before it (D62).
export const TestTrend = Object.freeze({
  IMPROVED: 'IMPROVED',
  DECLINED: 'DECLINED',
  UNCHANGED: 'UNCHANGED',
});

// A mock test is taken in full (timed, the first attempt earns XP) or one
// part at a time as a mini test (untimed, no XP) (D63).
export const MockAttemptKind = Object.freeze({ FULL: 'FULL', MINI: 'MINI' });

// Vocabulary practice (F05B-1, D84): words drawn from the completed lessons,
// asked word → meaning or meaning → word. It opens once the completed lessons
// hold this many different words.
export const VOCABULARY_PRACTICE_SIZE = 20;
// How a listening exercise is practised (D88): every sentence written down,
// or only the blanks of a song filled in. The best score is kept per mode.
export const ListeningMode = Object.freeze({ FULL: 'full', BLANKS: 'blanks' });
// The steps of a Listening course lesson that are checked (F05C, D100): the
// main-idea question, the detail questions, and each sentence written down.
export const CourseLessonStep = Object.freeze({ GIST: 'gist', DETAIL: 'detail', FOCUS: 'focus', CLOSE: 'close' });
// The answer key of one blank of a "complete the sentence" question (its id)
// or of the Focus on passage (COURSE_FOCUS_ID), by blank index (D109).
export const COURSE_FOCUS_ID = 'focus';
export const courseBlankKey = (id, index) => `${id}:${index}`;
// What is open in the Listening course (D102): each lesson, unit check and
// level test is LOCKED, OPEN or PASSED; each level is DONE (before the
// learner's level, open for review), CURRENT or LOCKED.
export const CourseItemState = Object.freeze({ LOCKED: 'LOCKED', OPEN: 'OPEN', PASSED: 'PASSED' });
export const CourseLevelState = Object.freeze({ DONE: 'DONE', CURRENT: 'CURRENT', LOCKED: 'LOCKED' });
// The listening placement (D103) is taken or skipped once.
export const CoursePlacementStatus = Object.freeze({ NOT_STARTED: 'NOT_STARTED', COMPLETED: 'COMPLETED', SKIPPED: 'SKIPPED' });
export const PracticeDirection = Object.freeze({ MEANING: 'MEANING', WORD: 'WORD' });

export const LESSON_TEST_DURATION_MINUTES = 25;
// Minimum lesson-test score (percent) that completes the lesson.
export const LESSON_PASS_PERCENT = 80;

// True when correctCount of totalCount reaches the pass mark; exact fractions,
// so 79.9% does not pass.
export function lessonTestPassed(correctCount, totalCount) {
  return totalCount > 0 && correctCount * 100 >= LESSON_PASS_PERCENT * totalCount;
}

// Learning codes share the numeric space of @appenglish/auth-contracts
// ResponseCode and @appenglish/content-contracts ContentResponseCode:
// 0 success, 26 forbidden role, 30 validation, 32 system; 50-69 are learning.
export const LearningResponseCode = Object.freeze({
  SUCCESS: 0,
  FORBIDDEN_ROLE: 26,
  VALIDATION_ERROR: 30,
  SYSTEM_ERROR: 32,
  PLACEMENT_NOT_AVAILABLE: 50,
  PLACEMENT_ALREADY_TAKEN: 51,
  PLACEMENT_NOT_IN_PROGRESS: 52,
  LESSON_NOT_FOUND: 53,
  LESSON_LOCKED: 54,
  LESSON_STEP_REQUIRED: 55,
  LESSON_TEST_NOT_IN_PROGRESS: 56,
  MOCK_TEST_NOT_FOUND: 57,
  MOCK_TEST_NOT_IN_PROGRESS: 58,
  LISTENING_EXERCISE_NOT_FOUND: 59,
  COURSE_LESSON_NOT_FOUND: 60,
  COURSE_ITEM_LOCKED: 61,
  COURSE_PLACEMENT_DONE: 62,
});

// Results leaving learning-service for progress-service (F06, D110) go as
// persistent JSON messages on one durable RabbitMQ queue. Every message is
// { id, type, occurredAt, payload }; id is unique per event, so a consumer
// can apply a message twice without counting it twice.
export const LearningQueue = Object.freeze({ RESULTS: 'learning.results' });

// Payloads by type (ids are uuids, times ISO strings):
// - LESSON_TEST_SUBMITTED: a finished lesson-test attempt. { attemptId,
//   accountId, lessonId, lessonVersionId, attemptNumber, correctCount,
//   totalCount, listeningCorrect, listeningTotal, readingCorrect,
//   readingTotal, passed, submittedAt }.
// - LESSON_COMPLETED: the lesson test was passed for the first time, so the
//   lesson is completed. { accountId, lessonId, completedAt }.
// - MOCK_SUBMITTED: a finished attempt of a full mock test (mini tests stay in
//   learning-service: no progress, no XP). { attemptId, accountId,
//   accountEmail (shown on the XP leaderboard, D112), mockTestId,
//   mockTestTitle, mockVersionId, kind, attemptNumber, correctCount,
//   totalCount, listeningCorrect, listeningTotal, readingCorrect,
//   readingTotal, listeningScore, readingScore, submittedAt }.
export const LearningEventType = Object.freeze({
  LESSON_TEST_SUBMITTED: 'lesson-test.submitted',
  LESSON_COMPLETED: 'lesson.completed',
  MOCK_SUBMITTED: 'mock.submitted',
});

export const PlacementStatus = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
});

export const PLACEMENT_DURATION_MINUTES = 25;

export const MOCK_STATS_MIN_LEARNERS = 5;
export const GOAL_SCORE = Object.freeze({ min: 10, max: 990, step: 5 });
export const GOAL_RECENT_ATTEMPTS = 5;
export const GOAL_MIN_ANSWERED = 3;
export const GOAL_STALE_DAYS = 14;
export const GOAL_HISTORY_SIZE = 20;
export const MOCK_MISTAKE_CLEAR_STREAK = 2;
export const MOCK_MISTAKE_SESSION = 10;
export const FORECAST_POINTS = 6;
export const FORECAST_MAX_DAYS = 365;
export const MockQuestionFlag = Object.freeze({ CHECK_KEY: 'CHECK_KEY', HARD: 'HARD', EASY: 'EASY' });

export const DEFAULT_PLACEMENT_THRESHOLDS = Object.freeze({
  unit2Threshold: 60,
  unit3Threshold: 80,
});

export function placementStartUnit(correctCount, totalCount, thresholds, publishedUnitCount) {
  const reaches = (threshold) => totalCount > 0 && correctCount * 100 >= threshold * totalCount;
  const unit = reaches(thresholds.unit3Threshold) ? 3 : reaches(thresholds.unit2Threshold) ? 2 : 1;
  return Math.max(1, Math.min(unit, publishedUnitCount));
}

export const LessonState = Object.freeze({
  LOCKED: 'LOCKED',
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
});

export const LessonStep = Object.freeze({
  REVIEW: 'review',
  VOCABULARY: 'vocabulary',
  VOCABULARY_QUIZ: 'quiz',
  FILL_IN: 'fillIn',
  TEST: 'test',
});

export const StepStatus = Object.freeze({ DONE: 'DONE', CURRENT: 'CURRENT', LOCKED: 'LOCKED' });

export const QuizKind = Object.freeze({ VOCABULARY: 'vocabulary', REVIEW: 'review' });

export const UnitReviewState = Object.freeze({
  NONE: 'NONE',
  LOCKED: 'LOCKED',
  OPEN: 'OPEN',
  PASSED: 'PASSED',
});

export const LessonTestStatus = Object.freeze({
  LOCKED: 'LOCKED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
});

export const TestTrend = Object.freeze({
  IMPROVED: 'IMPROVED',
  DECLINED: 'DECLINED',
  UNCHANGED: 'UNCHANGED',
});

export const MockAttemptKind = Object.freeze({ FULL: 'FULL', MINI: 'MINI' });

export const VOCABULARY_PRACTICE_SIZE = 20;
export const ListeningMode = Object.freeze({ FULL: 'full', BLANKS: 'blanks' });
export const CourseLevelState = Object.freeze({ OPEN: 'OPEN', LOCKED: 'LOCKED' });
export const CourseDictationMode = Object.freeze({ BLANKS: 'blanks', FULL: 'full' });
export const PracticeDirection = Object.freeze({ MEANING: 'MEANING', WORD: 'WORD' });

export const LESSON_TEST_DURATION_MINUTES = 25;
export const LESSON_PASS_PERCENT = 80;

export function lessonTestPassed(correctCount, totalCount) {
  return totalCount > 0 && correctCount * 100 >= LESSON_PASS_PERCENT * totalCount;
}

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
  UNIT_REVIEW_NOT_FOUND: 63,
  UNIT_REVIEW_LOCKED: 64,
});

export const LearningQueue = Object.freeze({ RESULTS: 'learning.results' });

export const LearningEventType = Object.freeze({
  LESSON_TEST_SUBMITTED: 'lesson-test.submitted',
  LESSON_COMPLETED: 'lesson.completed',
  MOCK_SUBMITTED: 'mock.submitted',
  ACTIVITY_RECORDED: 'activity.recorded',
  UNIT_REVIEW_PASSED: 'unit-review.passed',
  COURSE_LEVEL_UP: 'course.level-up',
});

export const StudyActivity = Object.freeze({
  LESSON_STEP: 'lessonStep',
  LESSON_TEST: 'lessonTest',
  UNIT_REVIEW: 'unitReview',
  COURSE_TOPIC: 'courseTopic',
  COURSE_TEST: 'courseTest',
  LISTENING_PRACTICE: 'listeningPractice',
  WORD_MEMORY: 'wordMemory',
  MOCK_TEST: 'mockTest',
  MISTAKE_REVIEW: 'mistakeReview',
});

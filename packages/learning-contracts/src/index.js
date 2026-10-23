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
  PRACTICE_PROMPT_NOT_FOUND: 65,
  SUBMISSION_NOT_FOUND: 66,
  RECORDING_INVALID: 67,
  PROMPT_KIND_NOT_READY: 68,
  AI_KEY_INVALID: 69,
  AI_KEY_UNAVAILABLE: 70,
  ANSWER_INVALID: 71,
});

export const LearningQueue = Object.freeze({
  RESULTS: 'learning.results',
  SPEAKING_REQUESTS: 'speech.speaking.requests',
  SPEAKING_RESULTS: 'speech.speaking.results',
  WRITING_REQUESTS: 'writing.grading.requests',
  WRITING_RESULTS: 'writing.grading.results',
  AI_KEY_CHECKS: 'writing.key-checks',
  OPEN_SPEAKING_RESULTS: 'writing.open-speaking.results',
});

export const LearningEventType = Object.freeze({
  LESSON_TEST_SUBMITTED: 'lesson-test.submitted',
  LESSON_COMPLETED: 'lesson.completed',
  MOCK_SUBMITTED: 'mock.submitted',
  ACTIVITY_RECORDED: 'activity.recorded',
  UNIT_REVIEW_PASSED: 'unit-review.passed',
  COURSE_LEVEL_UP: 'course.level-up',
  SPEAKING_REQUESTED: 'speaking.requested',
  SPEAKING_SCORED: 'speaking.scored',
  WRITING_REQUESTED: 'writing.requested',
  WRITING_SCORED: 'writing.scored',
  SPEAKING_GRADING_REQUESTED: 'speaking.grading.requested',
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
  SPEAKING: 'speaking',
  WRITING: 'writing',
});

export const SubmissionStatus = Object.freeze({ SCORING: 'SCORING', DONE: 'DONE', FAILED: 'FAILED', SAVED: 'SAVED' });
export const SpokenWordStatus = Object.freeze({ CORRECT: 'correct', MISPRONOUNCED: 'mispronounced', MISSING: 'missing' });
export const READ_ALOUD_SCORING = Object.freeze({
  confidence: 0.6,
  pauseSeconds: 0.7,
  pausePenaltyMax: 5,
  rate: Object.freeze({ min: 90, max: 180, wordsPerPoint: 10, penaltyMax: 5 }),
  weights: Object.freeze({ accuracy: 0.5, completeness: 0.3, fluency: 0.2 }),
});
export const RECORDING_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  readAloudSeconds: 30,
  openSpeakingSeconds: 120,
  mimeTypes: Object.freeze(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']),
});
export const RECORDING_KEEP_DAYS = 180;
export const SUBMISSION_HISTORY_SIZE = 20;

export const AI_KEY_LIMITS = Object.freeze({ min: 20, max: 200, pattern: /^[A-Za-z0-9_-]+$/ });
export const AiKeyCheck = Object.freeze({ VALID: 'VALID', INVALID: 'INVALID', UNAVAILABLE: 'UNAVAILABLE' });
export const WRITING_CRITERIA = Object.freeze(['cohesion', 'syntax', 'vocabulary', 'phraseology', 'grammar', 'conventions', 'task']);
export const WRITING_GROUPS = Object.freeze({
  vocabulary: Object.freeze(['vocabulary', 'phraseology']),
  grammar: Object.freeze(['syntax', 'grammar', 'conventions']),
  coherence: Object.freeze(['cohesion']),
  task: Object.freeze(['task']),
});
export const WRITING_LIMITS = Object.freeze({ answerChars: 6000, errors: 30, errorText: 300, feedbackChars: 2000, rewriteChars: 6000 });

const tenth = (value) => Math.floor(value * 10 + 0.5) / 10;

export function writingScores(criteria) {
  const groups = Object.fromEntries(
    Object.entries(WRITING_GROUPS).map(([group, keys]) => [group, tenth(keys.reduce((sum, key) => sum + criteria[key], 0) / keys.length)]),
  );
  const values = Object.values(groups);
  return { ...groups, total: tenth(values.reduce((sum, value) => sum + value, 0) / values.length) };
}

export function countWords(text) {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export const OPEN_SPEAKING_CRITERIA = Object.freeze(['task', 'vocabulary', 'grammar', 'coherence']);
export const OPEN_SPEAKING_WEIGHTS = Object.freeze({ gemini: 0.6, fluency: 0.2, pronunciation: 0.2 });

export function openSpeakingScores({ criteria, fluency, pronunciation }) {
  const scores = { fluency, pronunciation };
  if (!criteria) return { ...scores, total: null };
  for (const key of OPEN_SPEAKING_CRITERIA) scores[key] = criteria[key];
  const gemini = (OPEN_SPEAKING_CRITERIA.reduce((sum, key) => sum + criteria[key], 0) / OPEN_SPEAKING_CRITERIA.length) * 2;
  scores.total = tenth(OPEN_SPEAKING_WEIGHTS.gemini * gemini + OPEN_SPEAKING_WEIGHTS.fluency * fluency + OPEN_SPEAKING_WEIGHTS.pronunciation * pronunciation);
  return scores;
}

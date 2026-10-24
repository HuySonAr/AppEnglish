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
  REVIEW_LIMIT_REACHED: 72,
  REVIEW_NOT_ALLOWED: 73,
  REVIEW_NOT_FOUND: 74,
  REVIEW_LOCKED: 75,
});

export const LearningQueue = Object.freeze({
  RESULTS: 'learning.results',
  SPEAKING_REQUESTS: 'speech.speaking.requests',
  SPEAKING_RESULTS: 'speech.speaking.results',
  WRITING_REQUESTS: 'writing.grading.requests',
  WRITING_RESULTS: 'writing.grading.results',
  AI_KEY_CHECKS: 'writing.key-checks',
  OPEN_SPEAKING_RESULTS: 'writing.open-speaking.results',
  AI_MODEL_LISTS: 'writing.model-lists',
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
  REVIEW_COMPLETED: 'review.completed',
  REVIEW_EXPIRED: 'review.expired',
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

export const AI_KEY_LIMITS = Object.freeze({ min: 20, max: 300, pattern: /^[A-Za-z0-9._-]+$/ });
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

export const TEACHER_REVIEW_LIMITS = Object.freeze({ weekly: 3, lockHours: 2, expireHours: 48, note: 2000 });
export const ReviewStatus = Object.freeze({ WAITING: 'WAITING', DONE: 'DONE', EXPIRED: 'EXPIRED' });
export const ReviewAction = Object.freeze({ CONFIRM: 'CONFIRM', EDIT: 'EDIT', FROM_SCRATCH: 'FROM_SCRATCH' });

const band = Object.freeze({ min: 1, max: 5, step: 0.5 });
const ten = Object.freeze({ min: 0, max: 10, step: 0.1 });

export const REVIEW_CRITERIA = Object.freeze({
  read_aloud: Object.freeze([
    Object.freeze({ key: 'accuracy', label: 'Accuracy', ...ten }),
    Object.freeze({ key: 'completeness', label: 'Completeness', ...ten }),
    Object.freeze({ key: 'fluency', label: 'Fluency', ...ten }),
  ]),
  open_speaking: Object.freeze([
    Object.freeze({ key: 'task', label: 'Task', ...band }),
    Object.freeze({ key: 'vocabulary', label: 'Vocabulary', ...band }),
    Object.freeze({ key: 'grammar', label: 'Grammar', ...band }),
    Object.freeze({ key: 'coherence', label: 'Coherence', ...band }),
    Object.freeze({ key: 'fluency', label: 'Fluency', ...ten }),
    Object.freeze({ key: 'pronunciation', label: 'Pronunciation', ...ten }),
  ]),
  writing: Object.freeze([
    Object.freeze({ key: 'vocabulary', label: 'Vocabulary', ...band }),
    Object.freeze({ key: 'grammar', label: 'Grammar', ...band }),
    Object.freeze({ key: 'coherence', label: 'Coherence', ...band }),
    Object.freeze({ key: 'task', label: 'Task', ...band }),
  ]),
});

export const reviewMaxScore = (kind) => (kind === 'writing' ? 5 : 10);

export function reviewScores(kind, input) {
  const scores = Object.fromEntries(REVIEW_CRITERIA[kind].map(({ key }) => [key, input[key]]));
  if (kind === 'read_aloud') {
    const { weights } = READ_ALOUD_SCORING;
    return { ...scores, total: tenth(weights.accuracy * scores.accuracy + weights.completeness * scores.completeness + weights.fluency * scores.fluency) };
  }
  if (kind === 'open_speaking') return openSpeakingScores({ criteria: scores, fluency: scores.fluency, pronunciation: scores.pronunciation });
  return { ...scores, total: tenth((scores.vocabulary + scores.grammar + scores.coherence + scores.task) / 4) };
}

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function vietnamWeekStart(date = new Date()) {
  const local = new Date(new Date(date).getTime() + VIETNAM_OFFSET_MS);
  const day = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - day);
  return local.toISOString().slice(0, 10);
}

export const CEFR_ORDER = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const BELOW_A1 = 'BELOW_A1';
export const TOEIC_CEFR_MINIMUMS = Object.freeze({
  listening: Object.freeze({ A1: 60, A2: 110, B1: 275, B2: 400, C1: 490 }),
  reading: Object.freeze({ A1: 60, A2: 115, B1: 275, B2: 385, C1: 455 }),
});
export const PRODUCTIVE_CEFR_RULES = Object.freeze({
  speaking: Object.freeze({ kinds: Object.freeze(['open_speaking']), pass: 7, max: 10 }),
  writing: Object.freeze({ kinds: Object.freeze(['writing']), pass: 3.5, max: 5 }),
  recent: 5,
  needed: 3,
});

export function toeicCefr(skill, score) {
  if (!Number.isFinite(score)) return null;
  const minimums = TOEIC_CEFR_MINIMUMS[skill];
  let level = BELOW_A1;
  for (const [name, minimum] of Object.entries(minimums)) if (score >= minimum) level = name;
  return level;
}

export function productiveCefr(results, rule, { recent = PRODUCTIVE_CEFR_RULES.recent, needed = PRODUCTIVE_CEFR_RULES.needed } = {}) {
  const levels = CEFR_ORDER.map((level) => {
    const latest = results
      .filter((result) => result.level === level && Number.isFinite(result.total))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, recent);
    return { level, considered: latest.length, passed: latest.filter((result) => result.total >= rule.pass).length };
  }).filter((entry) => entry.considered > 0);
  const reached = levels.filter((entry) => entry.passed >= needed).map((entry) => entry.level);
  return { level: reached.length ? reached.at(-1) : null, levels };
}

export const GEMINI_MODELS = Object.freeze([
  Object.freeze({ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', defaultLevel: 'medium', levels: Object.freeze(['low', 'medium', 'high']) }),
  Object.freeze({ id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', defaultLevel: 'medium', levels: Object.freeze(['minimal', 'low', 'medium', 'high']) }),
  Object.freeze({ id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', defaultLevel: 'minimal', levels: Object.freeze(['minimal', 'low', 'medium', 'high']) }),
]);
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const GEMINI_MODEL_PATTERN = /^gemini-[a-z0-9][a-z0-9.-]{0,58}$/;
const NOT_FOR_GRADING = /embedding|image|imagen|tts|audio|live|robotics|computer-use|transcribe|banana|customtools|aqa|veo/;

export const knownGeminiModel = (id) => GEMINI_MODELS.find((item) => item.id === id) || null;
export const isGradingModel = (id) => GEMINI_MODEL_PATTERN.test(String(id || '')) && !NOT_FOR_GRADING.test(id);

export function geminiModelLabel(id) {
  const known = knownGeminiModel(id);
  if (known) return known.label;
  return String(id || 'Gemini')
    .split('-')
    .map((part) => (part === 'gemini' ? 'Gemini' : /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function geminiChoice(model, thinkingLevel) {
  const known = knownGeminiModel(model);
  if (known) return { model: known.id, thinkingLevel: known.levels.includes(thinkingLevel) ? thinkingLevel : null };
  return isGradingModel(model) ? { model, thinkingLevel: null } : null;
}

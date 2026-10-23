import { EntitySchema } from 'typeorm';

// One row per account: a learner takes or skips the placement test once
// (D35). answers maps question id to the chosen option id.
export const PlacementAttemptEntity = new EntitySchema({
  name: 'PlacementAttempt',
  tableName: 'placement_attempts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    status: { type: 'varchar', length: 16 },
    placementVersionId: { type: 'uuid', nullable: true },
    versionNumber: { type: 'int', nullable: true },
    startedAt: { type: 'timestamptz', nullable: true },
    expiresAt: { type: 'timestamptz', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    answers: { type: 'jsonb', default: {} },
    totalCount: { type: 'int', nullable: true },
    correctCount: { type: 'int', nullable: true },
    listeningCorrect: { type: 'int', nullable: true },
    readingCorrect: { type: 'int', nullable: true },
    startUnit: { type: 'int', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_placement_attempts_account', columns: ['accountId'], unique: true }],
});

// Single row (id 1): the score thresholds that decide the starting unit.
export const PlacementSettingsEntity = new EntitySchema({
  name: 'PlacementSettings',
  tableName: 'placement_settings',
  columns: {
    id: { type: 'smallint', primary: true },
    unit2Threshold: { type: 'int' },
    unit3Threshold: { type: 'int' },
    updatedBy: { type: 'uuid', nullable: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

// The learner's way through one lesson: when each step was finished. One row
// per account and lesson; it belongs to the lesson, not to a lesson version.
export const LessonProgressEntity = new EntitySchema({
  name: 'LessonProgress',
  tableName: 'lesson_progress',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    lessonId: { type: 'uuid' },
    reviewPassedAt: { type: 'timestamptz', nullable: true },
    vocabularyStudiedAt: { type: 'timestamptz', nullable: true },
    vocabularyQuizPassedAt: { type: 'timestamptz', nullable: true },
    fillInPassedAt: { type: 'timestamptz', nullable: true },
    completedAt: { type: 'timestamptz', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_lesson_progress_account_lesson', columns: ['accountId', 'lessonId'], unique: true },
  ],
});

// One attempt at a lesson test. optionOrder is the shuffled option order of
// this attempt; answers maps question id to the chosen option id.
// accountEmail is kept for the lesson ranking.
export const LessonTestAttemptEntity = new EntitySchema({
  name: 'LessonTestAttempt',
  tableName: 'lesson_test_attempts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    accountEmail: { type: 'varchar', length: 320, default: '' },
    lessonId: { type: 'uuid' },
    lessonVersionId: { type: 'uuid' },
    attemptNumber: { type: 'int' },
    status: { type: 'varchar', length: 16 },
    startedAt: { type: 'timestamptz' },
    expiresAt: { type: 'timestamptz' },
    submittedAt: { type: 'timestamptz', nullable: true },
    optionOrder: { type: 'jsonb', default: {} },
    answers: { type: 'jsonb', default: {} },
    totalCount: { type: 'int', nullable: true },
    correctCount: { type: 'int', nullable: true },
    listeningCorrect: { type: 'int', nullable: true },
    readingCorrect: { type: 'int', nullable: true },
    durationSeconds: { type: 'int', nullable: true },
    passed: { type: 'boolean', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    {
      name: 'UQ_lesson_test_attempts_number',
      columns: ['accountId', 'lessonId', 'attemptNumber'],
      unique: true,
    },
  ],
});

// One finished attempt at a unit review (D121): untimed, scored on submit.
// answers maps question id to the chosen option id; reviewVersionId is the
// content-service version it was scored against.
export const UnitReviewAttemptEntity = new EntitySchema({
  name: 'UnitReviewAttempt',
  tableName: 'unit_review_attempts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    unitId: { type: 'uuid' },
    reviewVersionId: { type: 'uuid' },
    attemptNumber: { type: 'int' },
    answers: { type: 'jsonb', default: {} },
    totalCount: { type: 'int' },
    correctCount: { type: 'int' },
    passed: { type: 'boolean' },
    submittedAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
  },
  indices: [{ name: 'UQ_unit_review_attempts_number', columns: ['accountId', 'unitId', 'attemptNumber'], unique: true }],
});

// One attempt at a mock test: the full test (kind FULL, partKey '') or the
// mini test of one part (kind MINI, partKey e.g. 'part5'). listeningScore and
// readingScore are the estimated TOEIC section scores of a full attempt.
export const MockAttemptEntity = new EntitySchema({
  name: 'MockAttempt',
  tableName: 'mock_attempts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    mockTestId: { type: 'uuid' },
    mockVersionId: { type: 'uuid' },
    kind: { type: 'varchar', length: 8 },
    partKey: { type: 'varchar', length: 8, default: '' },
    attemptNumber: { type: 'int' },
    status: { type: 'varchar', length: 16 },
    startedAt: { type: 'timestamptz' },
    expiresAt: { type: 'timestamptz', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    optionOrder: { type: 'jsonb', default: {} },
    answers: { type: 'jsonb', default: {} },
    totalCount: { type: 'int', nullable: true },
    correctCount: { type: 'int', nullable: true },
    listeningCorrect: { type: 'int', nullable: true },
    listeningTotal: { type: 'int', nullable: true },
    readingCorrect: { type: 'int', nullable: true },
    readingTotal: { type: 'int', nullable: true },
    listeningScore: { type: 'int', nullable: true },
    readingScore: { type: 'int', nullable: true },
    durationSeconds: { type: 'int', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    {
      name: 'UQ_mock_attempts_number',
      columns: ['accountId', 'mockTestId', 'kind', 'partKey', 'attemptNumber'],
      unique: true,
    },
  ],
});

export const MockReviewAnswerEntity = new EntitySchema({
  name: 'MockReviewAnswer',
  tableName: 'mock_review_answers',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    mockTestId: { type: 'uuid' },
    mockVersionId: { type: 'uuid' },
    partKey: { type: 'varchar', length: 8 },
    questionId: { type: 'uuid' },
    optionId: { type: 'uuid', nullable: true },
    correct: { type: 'boolean' },
    answeredAt: { type: 'timestamptz' },
  },
  indices: [{ name: 'IDX_mock_review_answers_account', columns: ['accountId', 'answeredAt'] }],
});

export const LearnerGoalEntity = new EntitySchema({
  name: 'LearnerGoal',
  tableName: 'learner_goals',
  columns: {
    accountId: { type: 'uuid', primary: true },
    targetScore: { type: 'int' },
    examDate: { type: 'date', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

// Single row (id 1): estimated section score for 0-100 right answers.
export const ScoreConversionEntity = new EntitySchema({
  name: 'ScoreConversion',
  tableName: 'score_conversion',
  columns: {
    id: { type: 'smallint', primary: true },
    listening: { type: 'jsonb' },
    reading: { type: 'jsonb' },
    updatedBy: { type: 'uuid', nullable: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});


// Listening practice (F05B-3, D86): one row per learner, dictation exercise
// and mode (full, or the blanks of a song, D88) with the best and the latest
// accuracy (percent) of their checks.
export const CourseLessonResultEntity = new EntitySchema({
  name: 'CourseLessonResult',
  tableName: 'course_lesson_results',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    unitId: { type: 'uuid' },
    lessonId: { type: 'uuid' },
    bestScore: { type: 'int' },
    lastScore: { type: 'int' },
    attemptCount: { type: 'int' },
    passedAt: { type: 'timestamptz', nullable: true },
    lastAttemptAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_course_lesson_results_account_lesson', columns: ['accountId', 'lessonId'], unique: true }],
});

export const CourseTestResultEntity = new EntitySchema({
  name: 'CourseTestResult',
  tableName: 'course_test_results',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    itemId: { type: 'uuid' },
    kind: { type: 'varchar', length: 12 },
    level: { type: 'varchar', length: 2 },
    bestScore: { type: 'int' },
    lastScore: { type: 'int' },
    attemptCount: { type: 'int' },
    passedAt: { type: 'timestamptz', nullable: true },
    lastAttemptAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_course_test_results_account_item', columns: ['accountId', 'itemId'], unique: true }],
});

export const ListeningResultEntity = new EntitySchema({
  name: 'ListeningResult',
  tableName: 'listening_results',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    exerciseId: { type: 'uuid' },
    mode: { type: 'varchar', length: 10, default: 'full' },
    bestAccuracy: { type: 'int' },
    lastAccuracy: { type: 'int' },
    checkCount: { type: 'int' },
    lastCheckedAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_listening_results_account_exercise_mode', columns: ['accountId', 'exerciseId', 'mode'], unique: true }],
});

// Outbox of the results sent to progress-service (F06, D110): each row is one
// event written together with the result it reports and relayed to RabbitMQ
// afterwards; publishedAt is set once the broker confirmed it.
export const LearningEventEntity = new EntitySchema({
  name: 'LearningEvent',
  tableName: 'learning_events',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    type: { type: 'varchar', length: 40 },
    payload: { type: 'jsonb' },
    createdAt: { type: 'timestamptz', createDate: true },
    publishedAt: { type: 'timestamptz', nullable: true },
  },
  indices: [{ name: 'IDX_learning_events_pending', columns: ['publishedAt', 'createdAt'] }],
});

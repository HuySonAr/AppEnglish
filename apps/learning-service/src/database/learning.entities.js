import { EntitySchema } from 'typeorm';

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

export const LearningEventEntity = new EntitySchema({
  name: 'LearningEvent',
  tableName: 'learning_events',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    type: { type: 'varchar', length: 40 },
    payload: { type: 'jsonb' },
    requestId: { type: 'varchar', length: 64, nullable: true },
    queue: { type: 'varchar', length: 60, nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    publishedAt: { type: 'timestamptz', nullable: true },
  },
  indices: [{ name: 'IDX_learning_events_pending', columns: ['publishedAt', 'createdAt'] }],
});

export const PracticeSubmissionEntity = new EntitySchema({
  name: 'PracticeSubmission',
  tableName: 'practice_submissions',
  columns: {
    id: { type: 'uuid', primary: true },
    accountId: { type: 'uuid' },
    promptId: { type: 'uuid' },
    promptVersionId: { type: 'uuid' },
    kind: { type: 'varchar', length: 20 },
    prompt: { type: 'jsonb' },
    answer: { type: 'text', nullable: true },
    teacherReview: { type: 'jsonb', nullable: true },
    recording: { type: 'jsonb', nullable: true },
    recordingDeletedAt: { type: 'timestamptz', nullable: true },
    status: { type: 'varchar', length: 12 },
    result: { type: 'jsonb', nullable: true },
    error: { type: 'varchar', length: 500, nullable: true },
    submittedAt: { type: 'timestamptz' },
    scoredAt: { type: 'timestamptz', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'IDX_practice_submissions_account', columns: ['accountId', 'promptId', 'submittedAt'] },
    { name: 'IDX_practice_submissions_recordings', columns: ['recordingDeletedAt', 'submittedAt'] },
  ],
});

export const AiKeyEntity = new EntitySchema({
  name: 'AiKey',
  tableName: 'ai_keys',
  columns: {
    accountId: { type: 'uuid', primary: true },
    provider: { type: 'varchar', length: 20, default: 'gemini' },
    sealed: { type: 'jsonb' },
    last4: { type: 'varchar', length: 4 },
    verifiedAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const ReviewRequestEntity = new EntitySchema({
  name: 'ReviewRequest',
  tableName: 'review_requests',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    submissionId: { type: 'uuid' },
    accountId: { type: 'uuid' },
    kind: { type: 'varchar', length: 20 },
    weekStart: { type: 'date' },
    status: { type: 'varchar', length: 10 },
    requestedAt: { type: 'timestamptz' },
    expiresAt: { type: 'timestamptz' },
    teacherId: { type: 'uuid', nullable: true },
    claimedAt: { type: 'timestamptz', nullable: true },
    lockedUntil: { type: 'timestamptz', nullable: true },
    completedAt: { type: 'timestamptz', nullable: true },
    action: { type: 'varchar', length: 14, nullable: true },
    before: { type: 'jsonb', nullable: true },
    after: { type: 'jsonb', nullable: true },
    note: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_review_requests_submission', columns: ['submissionId'], unique: true },
    { name: 'IDX_review_requests_queue', columns: ['status', 'requestedAt'] },
    { name: 'IDX_review_requests_week', columns: ['accountId', 'weekStart'] },
  ],
});

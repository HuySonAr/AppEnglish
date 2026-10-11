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


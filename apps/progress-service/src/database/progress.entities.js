import { EntitySchema } from 'typeorm';

// One finished test with its per-skill counts (F06, D33): a lesson-test
// attempt or a full mock-test attempt, as learning-service reported it. The
// id is the attempt id in learning-service, so a message applied twice is
// stored once. Exact counts are kept; percents are computed when read (D39).
export const SkillResultEntity = new EntitySchema({
  name: 'SkillResult',
  tableName: 'skill_results',
  columns: {
    id: { type: 'uuid', primary: true },
    accountId: { type: 'uuid' },
    source: { type: 'varchar', length: 16 },
    // The lesson id or the mock test id: the test the attempt belongs to.
    sourceId: { type: 'uuid' },
    attemptNumber: { type: 'int' },
    correctCount: { type: 'int' },
    totalCount: { type: 'int' },
    listeningCorrect: { type: 'int' },
    listeningTotal: { type: 'int' },
    readingCorrect: { type: 'int' },
    readingTotal: { type: 'int' },
    submittedAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
  },
  indices: [{ name: 'IDX_skill_results_account', columns: ['accountId'] }],
});

// A lesson the learner completed (its test passed for the first time). One
// row per learner and lesson; the lesson's existence is content-service's.
export const LessonCompletionEntity = new EntitySchema({
  name: 'LessonCompletion',
  tableName: 'lesson_completions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    lessonId: { type: 'uuid' },
    completedAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
  },
  indices: [{ name: 'UQ_lesson_completions_account_lesson', columns: ['accountId', 'lessonId'], unique: true }],
});

// XP earned on a mock test (F07, D63, D112): the first full attempt only,
// one row per learner and mock test. The id is the attempt id in
// learning-service. accountEmail and mockTestTitle are snapshots.
export const XpLedgerEntity = new EntitySchema({
  name: 'XpLedger',
  tableName: 'xp_ledger',
  columns: {
    id: { type: 'uuid', primary: true },
    accountId: { type: 'uuid' },
    accountEmail: { type: 'varchar', length: 320, default: '' },
    mockTestId: { type: 'uuid' },
    mockTestTitle: { type: 'varchar', length: 200, default: '' },
    correctCount: { type: 'int' },
    totalCount: { type: 'int' },
    xp: { type: 'int' },
    earnedAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
  },
  indices: [
    { name: 'UQ_xp_ledger_account_mock', columns: ['accountId', 'mockTestId'], unique: true },
    { name: 'IDX_xp_ledger_account', columns: ['accountId'] },
  ],
});

export const NotificationEntity = new EntitySchema({
  name: 'Notification',
  tableName: 'notifications',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    kind: { type: 'varchar', length: 32 },
    key: { type: 'varchar', length: 120 },
    data: { type: 'jsonb', default: () => "'{}'::jsonb" },
    createdAt: { type: 'timestamptz' },
    readAt: { type: 'timestamptz', nullable: true },
  },
  indices: [
    { name: 'UQ_notifications_account_key', columns: ['accountId', 'key'], unique: true },
    { name: 'IDX_notifications_account_created', columns: ['accountId', 'createdAt'] },
  ],
});

export const StudyDayEntity = new EntitySchema({
  name: 'StudyDay',
  tableName: 'study_days',
  columns: {
    accountId: { type: 'uuid', primary: true },
    day: { type: 'date', primary: true },
    activities: { type: 'jsonb', default: () => "'[]'::jsonb" },
    firstAt: { type: 'timestamptz' },
    lastAt: { type: 'timestamptz' },
  },
});

import { EntitySchema } from 'typeorm';

export const SkillResultEntity = new EntitySchema({
  name: 'SkillResult',
  tableName: 'skill_results',
  columns: {
    id: { type: 'uuid', primary: true },
    accountId: { type: 'uuid' },
    source: { type: 'varchar', length: 16 },
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

export const ProcessedMessageEntity = new EntitySchema({
  name: 'ProcessedMessage',
  tableName: 'processed_messages',
  columns: {
    messageId: { type: 'varchar', length: 64, primary: true },
    queue: { type: 'varchar', length: 80 },
    processedAt: { type: 'timestamptz' },
  },
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

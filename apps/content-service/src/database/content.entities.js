import { EntitySchema } from 'typeorm';

export const UnitEntity = new EntitySchema({
  name: 'Unit',
  tableName: 'units',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    title: { type: 'varchar', length: 200 },
    description: { type: 'text', default: '' },
    position: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    publishedAt: { type: 'timestamptz', nullable: true },
    reviewVersionId: { type: 'uuid', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const UnitReviewVersionEntity = new EntitySchema({
  name: 'UnitReviewVersion',
  tableName: 'unit_review_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    unitId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    editedBy: { type: 'uuid', nullable: true },
    submittedBy: { type: 'uuid', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    reviewNote: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_unit_review_versions_number', columns: ['unitId', 'versionNumber'], unique: true }],
});

export const LessonEntity = new EntitySchema({
  name: 'Lesson',
  tableName: 'lessons',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    unitId: { type: 'uuid' },
    title: { type: 'varchar', length: 200 },
    position: { type: 'int' },
    publishedVersionId: { type: 'uuid', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'IDX_lessons_unit_position', columns: ['unitId', 'position'] }],
});

export const LessonVersionEntity = new EntitySchema({
  name: 'LessonVersion',
  tableName: 'lesson_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    lessonId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    editedBy: { type: 'uuid', nullable: true },
    submittedBy: { type: 'uuid', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    reviewNote: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_lesson_versions_number', columns: ['lessonId', 'versionNumber'], unique: true },
  ],
});

export const MediaAssetEntity = new EntitySchema({
  name: 'MediaAsset',
  tableName: 'media_assets',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    kind: { type: 'varchar', length: 16 },
    storage: { type: 'varchar', length: 16 },
    storageId: { type: 'varchar', length: 255 },
    url: { type: 'text' },
    fileName: { type: 'varchar', length: 255 },
    mimeType: { type: 'varchar', length: 128 },
    sizeBytes: { type: 'int' },
    uploadedBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
  },
});

export const PlacementVersionEntity = new EntitySchema({
  name: 'PlacementVersion',
  tableName: 'placement_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    editedBy: { type: 'uuid', nullable: true },
    submittedBy: { type: 'uuid', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    reviewNote: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_placement_versions_number', columns: ['versionNumber'], unique: true }],
});

export const ExamTypeEntity = new EntitySchema({
  name: 'ExamType',
  tableName: 'exam_types',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    code: { type: 'varchar', length: 40 },
    name: { type: 'varchar', length: 100 },
    format: { type: 'varchar', length: 20, nullable: true },
    level: { type: 'varchar', length: 20, nullable: true },
    createdBy: { type: 'uuid', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_exam_types_code', columns: ['code'], unique: true }],
});

export const MockTestEntity = new EntitySchema({
  name: 'MockTest',
  tableName: 'mock_tests',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    examTypeId: { type: 'uuid' },
    title: { type: 'varchar', length: 200 },
    level: { type: 'int' },
    durationMinutes: { type: 'int' },
    format: { type: 'varchar', length: 16, default: 'full' },
    publishedVersionId: { type: 'uuid', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const MockTestVersionEntity = new EntitySchema({
  name: 'MockTestVersion',
  tableName: 'mock_test_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    mockTestId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    editedBy: { type: 'uuid', nullable: true },
    submittedBy: { type: 'uuid', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    reviewNote: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_mock_test_versions_number', columns: ['mockTestId', 'versionNumber'], unique: true },
  ],
});

export const SwTestEntity = new EntitySchema({
  name: 'SwTest',
  tableName: 'sw_tests',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    title: { type: 'varchar', length: 200 },
    publishedVersionId: { type: 'uuid', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const SwTestVersionEntity = new EntitySchema({
  name: 'SwTestVersion',
  tableName: 'sw_test_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    swTestId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    editedBy: { type: 'uuid', nullable: true },
    submittedBy: { type: 'uuid', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    reviewNote: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_sw_test_versions_number', columns: ['swTestId', 'versionNumber'], unique: true }],
});

export const ListeningTopicEntity = new EntitySchema({
  name: 'ListeningTopic',
  tableName: 'listening_topics',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    code: { type: 'varchar', length: 40 },
    name: { type: 'varchar', length: 100 },
    format: { type: 'varchar', length: 20, nullable: true },
    createdBy: { type: 'uuid', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_listening_topics_code', columns: ['code'], unique: true }],
});

export const ListeningTestEntity = new EntitySchema({
  name: 'ListeningTest',
  tableName: 'listening_tests',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    topicId: { type: 'uuid' },
    name: { type: 'varchar', length: 100 },
    createdBy: { type: 'uuid', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const ListeningExerciseEntity = new EntitySchema({
  name: 'ListeningExercise',
  tableName: 'listening_exercises',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    topicId: { type: 'uuid' },
    testId: { type: 'uuid', nullable: true },
    title: { type: 'varchar', length: 200 },
    level: { type: 'varchar', length: 2 },
    kind: { type: 'varchar', length: 20 },
    publishedVersionId: { type: 'uuid', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const ListeningExerciseVersionEntity = new EntitySchema({
  name: 'ListeningExerciseVersion',
  tableName: 'listening_exercise_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    exerciseId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    editedBy: { type: 'uuid', nullable: true },
    submittedBy: { type: 'uuid', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    reviewNote: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_listening_exercise_versions_number', columns: ['exerciseId', 'versionNumber'], unique: true },
  ],
});

export const PracticePromptEntity = new EntitySchema({
  name: 'PracticePrompt',
  tableName: 'practice_prompts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    kind: { type: 'varchar', length: 20 },
    authorId: { type: 'uuid' },
    publishedVersionId: { type: 'uuid', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'IDX_practice_prompts_author', columns: ['authorId'] }],
});

export const PracticePromptVersionEntity = new EntitySchema({
  name: 'PracticePromptVersion',
  tableName: 'practice_prompt_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    promptId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 20 },
    content: { type: 'jsonb' },
    reviewNote: { type: 'text', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    reviewedBy: { type: 'uuid', nullable: true },
    reviewedAt: { type: 'timestamptz', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_practice_prompt_versions_number', columns: ['promptId', 'versionNumber'], unique: true },
    { name: 'IDX_practice_prompt_versions_status', columns: ['status'] },
  ],
});

export const ContentEventEntity = new EntitySchema({
  name: 'ContentEvent',
  tableName: 'content_events',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    type: { type: 'varchar', length: 40 },
    payload: { type: 'jsonb' },
    requestId: { type: 'varchar', length: 64, nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    publishedAt: { type: 'timestamptz', nullable: true },
  },
  indices: [{ name: 'IDX_content_events_pending', columns: ['publishedAt', 'createdAt'] }],
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

export const AdminNoticeEntity = new EntitySchema({
  name: 'AdminNotice',
  tableName: 'admin_notices',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    kind: { type: 'varchar', length: 32 },
    key: { type: 'varchar', length: 160 },
    data: { type: 'jsonb', default: () => "'{}'::jsonb" },
    createdAt: { type: 'timestamptz' },
  },
  indices: [
    { name: 'UQ_admin_notices_key', columns: ['key'], unique: true },
    { name: 'IDX_admin_notices_created', columns: ['createdAt'] },
  ],
});

export const AdminNoticeReadEntity = new EntitySchema({
  name: 'AdminNoticeRead',
  tableName: 'admin_notice_reads',
  columns: {
    accountId: { type: 'uuid', primary: true },
    key: { type: 'varchar', length: 160, primary: true },
    readAt: { type: 'timestamptz' },
  },
});

export const ListeningTimingJobEntity = new EntitySchema({
  name: 'ListeningTimingJob',
  tableName: 'listening_timing_jobs',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    exerciseId: { type: 'uuid', nullable: true },
    mockTestId: { type: 'uuid', nullable: true },
    practicePromptId: { type: 'uuid', nullable: true },
    audioMediaId: { type: 'uuid', nullable: true },
    task: { type: 'varchar', length: 16, default: 'align' },
    status: { type: 'varchar', length: 16 },
    lines: { type: 'jsonb' },
    result: { type: 'jsonb', nullable: true },
    error: { type: 'text', nullable: true },
    requestedBy: { type: 'uuid' },
    seenAt: { type: 'timestamptz', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'IDX_listening_timing_jobs_requester', columns: ['requestedBy', 'updatedAt'] },
    { name: 'IDX_listening_timing_jobs_exercise', columns: ['exerciseId', 'createdAt'] },
    { name: 'IDX_listening_timing_jobs_mock_test', columns: ['mockTestId', 'createdAt'] },
  ],
});

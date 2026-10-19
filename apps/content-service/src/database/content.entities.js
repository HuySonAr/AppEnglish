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
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
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

// One row per lesson version. A PUBLISHED row is never updated (D40); edits
// go to the lesson's single DRAFT row and publishing creates the next version.
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

// One row per version of the single placement test; same life cycle as
// LessonVersion.
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
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_placement_versions_number', columns: ['versionNumber'], unique: true }],
});

// A mock test: title, suggested level (1-3) and time allowed. Its questions
// live in MockTestVersion rows with the same life cycle as LessonVersion.
// A kind of exam the content is written for, e.g. TOEIC. format says which
// editor and test screen its tests use; null means none exists yet.
export const ExamTypeEntity = new EntitySchema({
  name: 'ExamType',
  tableName: 'exam_types',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    code: { type: 'varchar', length: 40 },
    name: { type: 'varchar', length: 100 },
    format: { type: 'varchar', length: 20, nullable: true },
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
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_mock_test_versions_number', columns: ['mockTestId', 'versionNumber'], unique: true },
  ],
});


// Listening practice (F05B-2, D85): topics, exercises and their versions,
// with the same life cycle as mock tests (a PUBLISHED version never changes).
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

export const ListeningExerciseEntity = new EntitySchema({
  name: 'ListeningExercise',
  tableName: 'listening_exercises',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    topicId: { type: 'uuid' },
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
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [
    { name: 'UQ_listening_exercise_versions_number', columns: ['exerciseId', 'versionNumber'], unique: true },
  ],
});

// Auto-time jobs (D97): one row per request for the times of an exercise's
// lines, answered by speech-service. lines are the lines asked about
// ({ id, text }), result the answer ({ id, start, end, matched }).
export const ListeningTimingJobEntity = new EntitySchema({
  name: 'ListeningTimingJob',
  tableName: 'listening_timing_jobs',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    exerciseId: { type: 'uuid' },
    // align (Auto-time, D97) or transcribe (D98).
    task: { type: 'varchar', length: 16, default: 'align' },
    status: { type: 'varchar', length: 16 },
    lines: { type: 'jsonb' },
    result: { type: 'jsonb', nullable: true },
    error: { type: 'text', nullable: true },
    requestedBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'IDX_listening_timing_jobs_exercise', columns: ['exerciseId', 'createdAt'] }],
});

// Listening course (F05C, D100): units and level tests of the CEFR levels,
// versioned like mock tests (a PUBLISHED version never changes).
export const ListeningCourseItemEntity = new EntitySchema({
  name: 'ListeningCourseItem',
  tableName: 'listening_course_items',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    level: { type: 'varchar', length: 2, nullable: true },
    type: { type: 'varchar', length: 16 },
    // The section of a unit (D107); null for a level test and the placement.
    section: { type: 'varchar', length: 24, nullable: true },
    title: { type: 'varchar', length: 200 },
    description: { type: 'text', default: '' },
    position: { type: 'int' },
    publishedVersionId: { type: 'uuid', nullable: true },
    createdBy: { type: 'uuid' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});

export const ListeningCourseVersionEntity = new EntitySchema({
  name: 'ListeningCourseVersion',
  tableName: 'listening_course_versions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    itemId: { type: 'uuid' },
    versionNumber: { type: 'int' },
    status: { type: 'varchar', length: 16, default: 'DRAFT' },
    content: { type: 'jsonb' },
    createdBy: { type: 'uuid' },
    publishedBy: { type: 'uuid', nullable: true },
    publishedAt: { type: 'timestamptz', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_listening_course_versions_number', columns: ['itemId', 'versionNumber'], unique: true }],
});


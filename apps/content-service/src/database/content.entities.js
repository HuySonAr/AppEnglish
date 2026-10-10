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

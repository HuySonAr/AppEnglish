import { In, MoreThan } from 'typeorm';
import {
  AdminNoticeEntity,
  AdminNoticeReadEntity,
  ExamTypeEntity,
  LessonEntity,
  LessonVersionEntity,
  ListeningCourseVersionEntity,
  ListeningExerciseVersionEntity,
  MediaAssetEntity,
  MockTestEntity,
  MockTestVersionEntity,
  PlacementVersionEntity,
  UnitEntity,
  UnitReviewVersionEntity,
} from '../database/content.entities.js';

export class ContentRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async addAdminNotice(notice) {
    await (await this.repo(AdminNoticeEntity)).createQueryBuilder().insert().values(notice).orIgnore().execute();
  }

  async listAdminNotices(since) {
    return (await this.repo(AdminNoticeEntity)).find({ where: { createdAt: MoreThan(since) }, order: { createdAt: 'DESC' } });
  }

  async readNoticeKeys(accountId, keys) {
    if (!keys.length) return new Set();
    return new Set((await (await this.repo(AdminNoticeReadEntity)).find({ where: { accountId, key: In(keys) } })).map((row) => row.key));
  }

  async markNoticesRead(accountId, keys, at) {
    if (!keys.length) return;
    await (await this.repo(AdminNoticeReadEntity)).createQueryBuilder().insert().values(keys.map((key) => ({ accountId, key, readAt: at }))).orIgnore().execute();
  }

  async listUnits() {
    return (await this.repo(UnitEntity)).find({ order: { position: 'ASC' } });
  }

  async findUnit(id) {
    return (await this.repo(UnitEntity)).findOne({ where: { id } });
  }

  async saveUnit(unit) {
    return (await this.repo(UnitEntity)).save(unit);
  }

  async saveUnits(units) {
    return this.saveInOrder(UnitEntity, units);
  }

  // Saves rows one by one in a transaction. TypeORM's save(array) issues the
  // updates concurrently on one connection, which pg deprecates.
  async saveInOrder(entity, rows) {
    await this.repo(entity);
    return this.dataSource.transaction(async (manager) => {
      for (const row of rows) await manager.getRepository(entity).save(row);
    });
  }

  async listLessons() {
    return (await this.repo(LessonEntity)).find({ order: { position: 'ASC' } });
  }

  async listLessonsByUnit(unitId) {
    return (await this.repo(LessonEntity)).find({
      where: { unitId },
      order: { position: 'ASC' },
    });
  }

  async findLesson(id) {
    return (await this.repo(LessonEntity)).findOne({ where: { id } });
  }

  async saveLesson(lesson) {
    return (await this.repo(LessonEntity)).save(lesson);
  }

  async saveLessons(lessons) {
    return this.saveInOrder(LessonEntity, lessons);
  }

  async createLessonWithDraft(lesson, draft) {
    await this.repo(LessonEntity);
    return this.dataSource.transaction(async (manager) => {
      const savedLesson = await manager.getRepository(LessonEntity).save(lesson);
      const savedDraft = await manager
        .getRepository(LessonVersionEntity)
        .save({ ...draft, lessonId: savedLesson.id });
      return { lesson: savedLesson, draft: savedDraft };
    });
  }

  // Version metadata without the content payload.
  async listVersionSummaries() {
    return (await this.repo(LessonVersionEntity)).find({
      select: { id: true, lessonId: true, versionNumber: true, status: true },
    });
  }

  async findDraft(lessonId) {
    return (await this.repo(LessonVersionEntity)).findOne({
      where: { lessonId, status: 'DRAFT' },
    });
  }

  async findVersion(id) {
    return (await this.repo(LessonVersionEntity)).findOne({ where: { id } });
  }

  async maxVersionNumber(lessonId) {
    return (await (await this.repo(LessonVersionEntity)).maximum('versionNumber', { lessonId })) || 0;
  }

  async saveVersion(version) {
    return (await this.repo(LessonVersionEntity)).save(version);
  }

  async publishVersion(lesson, version) {
    await this.repo(LessonEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(LessonVersionEntity).save(version);
      await manager.getRepository(LessonEntity).save(lesson);
    });
  }

  async findMediaByIds(ids) {
    return (await this.repo(MediaAssetEntity)).find({ where: { id: In(ids) } });
  }

  async saveMedia(asset) {
    return (await this.repo(MediaAssetEntity)).save(asset);
  }

  async deleteMedia(id) {
    await (await this.repo(MediaAssetEntity)).delete({ id });
  }

  // True when any saved lesson, placement, mock-test or listening-exercise
  // version, draft or published, refers to the media.
  async isMediaReferenced(id) {
    for (const entity of [LessonVersionEntity, PlacementVersionEntity, MockTestVersionEntity, ListeningExerciseVersionEntity, ListeningCourseVersionEntity]) {
      const count = await (await this.repo(entity))
        .createQueryBuilder('version')
        .where('CAST(version.content AS text) LIKE :pattern', { pattern: `%${id}%` })
        .getCount();
      if (count > 0) return true;
    }
    return false;
  }

  // Every media id any saved version refers to, read once across the version
  // tables (one query each): the orphan listing checks hundreds of files
  // against this set instead of querying per file.
  async listReferencedMediaIds() {
    const referenced = new Set();
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    for (const entity of [LessonVersionEntity, PlacementVersionEntity, MockTestVersionEntity, ListeningExerciseVersionEntity, ListeningCourseVersionEntity, UnitReviewVersionEntity]) {
      const rows = await (await this.repo(entity)).createQueryBuilder('version').select('version.content', 'content').getRawMany();
      for (const row of rows) for (const match of JSON.stringify(row.content).matchAll(uuid)) referenced.add(match[0].toLowerCase());
    }
    return referenced;
  }

  // Every media row older than the given time; the service checks references.
  async listMediaBefore(before) {
    return (await this.repo(MediaAssetEntity)).createQueryBuilder('media').where('media."createdAt" < :before', { before }).orderBy('media."createdAt"', 'ASC').getMany();
  }

  // Taking content away (D118). Versions go with their lesson, lessons with
  // their unit, in one transaction.
  async deleteLessonWithVersions(lessonId) {
    await this.repo(LessonEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(LessonVersionEntity).delete({ lessonId });
      await manager.getRepository(LessonEntity).delete({ id: lessonId });
    });
  }

  async deleteUnitWithLessons(unitId, lessonIds) {
    await this.repo(UnitEntity);
    return this.dataSource.transaction(async (manager) => {
      if (lessonIds.length) {
        await manager.getRepository(LessonVersionEntity).delete({ lessonId: In(lessonIds) });
        await manager.getRepository(LessonEntity).delete({ id: In(lessonIds) });
      }
      await manager.getRepository(UnitReviewVersionEntity).delete({ unitId });
      await manager.getRepository(UnitEntity).delete({ id: unitId });
    });
  }

  // ----- Version history (D122), for any versioned content.

  // The versions of one owner (a lesson, mock test, exercise, course item or
  // unit), newest first, without their content.
  async listVersionsOf(entity, ownerColumn, ownerId) {
    return (await this.repo(entity)).find({
      where: { [ownerColumn]: ownerId },
      select: { id: true, [ownerColumn]: true, versionNumber: true, status: true, publishedAt: true, publishedBy: true, createdAt: true, createdBy: true },
      order: { versionNumber: 'DESC' },
    });
  }

  async findVersionOf(entity, id) {
    return (await this.repo(entity)).findOne({ where: { id } });
  }

  // Removes one version row (a discarded draft, D127).
  async deleteVersionOf(entity, id) {
    await (await this.repo(entity)).delete({ id });
  }

  // ----- Unit reviews (D121), versioned like lessons.

  async listReviewVersionSummaries() {
    return (await this.repo(UnitReviewVersionEntity)).find({
      select: { id: true, unitId: true, versionNumber: true, status: true },
    });
  }

  async findReviewDraft(unitId) {
    return (await this.repo(UnitReviewVersionEntity)).findOne({ where: { unitId, status: 'DRAFT' } });
  }

  async findReviewVersion(id) {
    return (await this.repo(UnitReviewVersionEntity)).findOne({ where: { id } });
  }

  async maxReviewVersionNumber(unitId) {
    return (await (await this.repo(UnitReviewVersionEntity)).maximum('versionNumber', { unitId })) || 0;
  }

  async saveReviewVersion(version) {
    return (await this.repo(UnitReviewVersionEntity)).save(version);
  }

  async publishReviewVersion(unit, version) {
    await this.repo(UnitEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(UnitReviewVersionEntity).save(version);
      await manager.getRepository(UnitEntity).save(unit);
    });
  }

  async deleteMockTestWithVersions(mockTestId) {
    await this.repo(MockTestEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MockTestVersionEntity).delete({ mockTestId });
      await manager.getRepository(MockTestEntity).delete({ id: mockTestId });
    });
  }

  async listExamTypes() {
    return (await this.repo(ExamTypeEntity)).find({ order: { createdAt: 'ASC' } });
  }

  async findExamType(id) {
    return (await this.repo(ExamTypeEntity)).findOne({ where: { id } });
  }

  async saveExamType(examType) {
    return (await this.repo(ExamTypeEntity)).save(examType);
  }

  async listMockTests() {
    return (await this.repo(MockTestEntity)).find({ order: { level: 'ASC', createdAt: 'ASC' } });
  }

  async findMockTest(id) {
    return (await this.repo(MockTestEntity)).findOne({ where: { id } });
  }

  async saveMockTest(mockTest) {
    return (await this.repo(MockTestEntity)).save(mockTest);
  }

  // Version metadata without the content payload.
  async listMockVersionSummaries() {
    return (await this.repo(MockTestVersionEntity)).find({
      select: { id: true, mockTestId: true, versionNumber: true, status: true },
    });
  }

  async findMockDraft(mockTestId) {
    return (await this.repo(MockTestVersionEntity)).findOne({ where: { mockTestId, status: 'DRAFT' } });
  }

  async findMockVersion(id) {
    return (await this.repo(MockTestVersionEntity)).findOne({ where: { id } });
  }

  async maxMockVersionNumber(mockTestId) {
    return (await (await this.repo(MockTestVersionEntity)).maximum('versionNumber', { mockTestId })) || 0;
  }

  async saveMockVersion(version) {
    return (await this.repo(MockTestVersionEntity)).save(version);
  }

  async publishMockVersion(mockTest, version) {
    await this.repo(MockTestEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MockTestVersionEntity).save(version);
      await manager.getRepository(MockTestEntity).save(mockTest);
    });
  }

  async countPublishedUnits() {
    return (await this.repo(UnitEntity)).count({ where: { status: 'PUBLISHED' } });
  }

  async findPlacementDraft() {
    return (await this.repo(PlacementVersionEntity)).findOne({ where: { status: 'DRAFT' } });
  }

  async findPlacementVersion(id) {
    return (await this.repo(PlacementVersionEntity)).findOne({ where: { id } });
  }

  async findPublishedPlacement() {
    return (await this.repo(PlacementVersionEntity)).findOne({
      where: { status: 'PUBLISHED' },
      order: { versionNumber: 'DESC' },
    });
  }

  async maxPlacementVersionNumber() {
    return (await (await this.repo(PlacementVersionEntity)).maximum('versionNumber', {})) || 0;
  }

  async savePlacementVersion(version) {
    return (await this.repo(PlacementVersionEntity)).save(version);
  }
}

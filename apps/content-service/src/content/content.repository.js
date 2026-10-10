import { In } from 'typeorm';
import {
  LessonEntity,
  LessonVersionEntity,
  MediaAssetEntity,
  UnitEntity,
} from '../database/content.entities.js';

export class ContentRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
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

  // True when any saved lesson version, draft or published, refers to the media.
  async isMediaReferenced(id) {
    const count = await (await this.repo(LessonVersionEntity))
      .createQueryBuilder('version')
      .where('CAST(version.content AS text) LIKE :pattern', { pattern: `%${id}%` })
      .getCount();
    return count > 0;
  }
}

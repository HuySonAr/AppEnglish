import { ListeningCourseItemEntity, ListeningCourseVersionEntity } from '../database/content.entities.js';

export class CourseRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async listItems() {
    return (await this.repo(ListeningCourseItemEntity)).find({ order: { level: 'ASC', position: 'ASC' } });
  }

  async findItem(id) {
    return (await this.repo(ListeningCourseItemEntity)).findOne({ where: { id } });
  }

  async saveItem(item) {
    return (await this.repo(ListeningCourseItemEntity)).save(item);
  }

  async saveItems(items) {
    await this.repo(ListeningCourseItemEntity);
    return this.dataSource.transaction(async (manager) => {
      for (const item of items) await manager.getRepository(ListeningCourseItemEntity).save(item);
    });
  }

  async createItemWithDraft(item, draft) {
    await this.repo(ListeningCourseItemEntity);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(ListeningCourseItemEntity).save(item);
        const version = await manager.getRepository(ListeningCourseVersionEntity).save({ ...draft, itemId: saved.id });
        return { item: saved, draft: version };
      });
    } catch (error) {
      if (error?.code === '23505') return null;
      throw error;
    }
  }

  async deleteItemWithVersions(itemId) {
    await this.repo(ListeningCourseItemEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ListeningCourseVersionEntity).delete({ itemId });
      await manager.getRepository(ListeningCourseItemEntity).delete({ id: itemId });
    });
  }

  async listVersionSummaries() {
    return (await this.repo(ListeningCourseVersionEntity)).find({
      select: { id: true, itemId: true, versionNumber: true, status: true },
    });
  }

  async findDraft(itemId) {
    return (await this.repo(ListeningCourseVersionEntity)).findOne({ where: { itemId, status: 'DRAFT' } });
  }

  async findVersion(id) {
    return (await this.repo(ListeningCourseVersionEntity)).findOne({ where: { id } });
  }

  async maxVersionNumber(itemId) {
    return (await (await this.repo(ListeningCourseVersionEntity)).maximum('versionNumber', { itemId })) || 0;
  }

  async saveVersion(version) {
    return (await this.repo(ListeningCourseVersionEntity)).save(version);
  }

  async publishVersion(item, version) {
    await this.repo(ListeningCourseItemEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ListeningCourseVersionEntity).save(version);
      await manager.getRepository(ListeningCourseItemEntity).save(item);
    });
  }
}

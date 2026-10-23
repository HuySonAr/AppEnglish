import { IsNull } from 'typeorm';
import { LearningEventEntity } from '../database/learning.entities.js';

export class EventRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(LearningEventEntity);
  }

  async addEvent(event) {
    return (await this.repo()).save(event);
  }

  async listPendingEvents(limit = 100) {
    return (await this.repo()).find({ where: { publishedAt: IsNull() }, order: { createdAt: 'ASC' }, take: limit });
  }

  async markPublished(id, at) {
    await (await this.repo()).update({ id }, { publishedAt: at });
  }
}

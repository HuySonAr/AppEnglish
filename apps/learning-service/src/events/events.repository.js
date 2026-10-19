import { IsNull } from 'typeorm';
import { LearningEventEntity } from '../database/learning.entities.js';

// The outbox of results sent to progress-service (F06, D110).
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

  // Events not yet confirmed by the broker, oldest first.
  async listPendingEvents(limit = 100) {
    return (await this.repo()).find({ where: { publishedAt: IsNull() }, order: { createdAt: 'ASC' }, take: limit });
  }

  async markPublished(id, at) {
    await (await this.repo()).update({ id }, { publishedAt: at });
  }
}

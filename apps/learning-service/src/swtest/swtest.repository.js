import { IsNull, LessThan, Not } from 'typeorm';
import { LearningEventEntity, SwAttemptEntity, SwScoreConversionEntity, SwScoreJobEntity } from '../database/learning.entities.js';

export class SwTestRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async source() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource;
  }

  async repo() {
    return (await this.source()).getRepository(SwAttemptEntity);
  }

  async findAttempt(id) {
    return (await this.repo()).findOne({ where: { id } });
  }

  async findJob(id) {
    return (await this.source()).getRepository(SwScoreJobEntity).findOne({ where: { id } });
  }

  async saveScoring(attempt, jobs = [], events = []) {
    return (await this.source()).transaction(async (manager) => {
      const saved = await manager.getRepository(SwAttemptEntity).save(attempt);
      if (jobs.length) await manager.getRepository(SwScoreJobEntity).save(jobs);
      if (events.length) await manager.getRepository(LearningEventEntity).save(events);
      return saved;
    });
  }

  async findConversion() {
    return (await this.source()).getRepository(SwScoreConversionEntity).findOne({ where: { id: 1 } });
  }

  async saveConversion(row) {
    return (await this.source()).getRepository(SwScoreConversionEntity).save({ id: 1, ...row });
  }

  async listAttempts(accountId, testId) {
    return (await this.repo()).find({ where: { accountId, ...(testId ? { testId } : {}) }, order: { startedAt: 'ASC' } });
  }

  async findOpen(accountId, testId, section) {
    return (await this.repo()).findOne({ where: { accountId, testId, section, status: 'IN_PROGRESS' } });
  }

  async saveAttempt(attempt) {
    return (await this.repo()).save(attempt);
  }

  async deleteAttempt(id) {
    await (await this.repo()).delete({ id });
  }

  async listExpiredRecordings(before, limit) {
    return (await this.repo()).find({ where: { recordingDeletedAt: IsNull(), status: 'SUBMITTED', submittedAt: LessThan(before), section: 'speaking', recordings: Not('{}') }, order: { submittedAt: 'ASC' }, take: limit });
  }

  async markRecordingsDeleted(id, at) {
    await (await this.repo()).update({ id }, { recordingDeletedAt: at });
  }
}

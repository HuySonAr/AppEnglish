import { LessonProgressEntity, LessonTestAttemptEntity, UnitReviewAttemptEntity } from '../database/learning.entities.js';

export class LessonRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async listProgress(accountId) {
    return (await this.repo(LessonProgressEntity)).find({ where: { accountId } });
  }

  async findProgress(accountId, lessonId) {
    return (await this.repo(LessonProgressEntity)).findOne({ where: { accountId, lessonId } });
  }

  async saveProgress(progress) {
    const repository = await this.repo(LessonProgressEntity);
    if (progress.id) return repository.save(progress);
    await repository
      .createQueryBuilder()
      .insert()
      .values(progress)
      .orIgnore()
      .execute();
    const stored = await this.findProgress(progress.accountId, progress.lessonId);
    return repository.save({ ...stored, ...progress, id: stored.id });
  }

  async listAttempts(accountId, lessonId) {
    return (await this.repo(LessonTestAttemptEntity)).find({
      where: { accountId, lessonId },
      order: { attemptNumber: 'ASC' },
    });
  }

  async listCompletedAttempts(accountId) {
    return (await this.repo(LessonTestAttemptEntity)).find({
      where: { accountId, status: 'COMPLETED' },
      select: { lessonId: true, correctCount: true, totalCount: true },
    });
  }

  async createAttempt(attempt) {
    try {
      return await (await this.repo(LessonTestAttemptEntity)).save(attempt);
    } catch (error) {
      if (error?.code === '23505') return null;
      throw error;
    }
  }

  async saveAttempt(attempt) {
    return (await this.repo(LessonTestAttemptEntity)).save(attempt);
  }

  async deleteOpenAttempt(id) {
    await (await this.repo(LessonTestAttemptEntity)).delete({ id, status: 'IN_PROGRESS' });
  }

  async listReviewAttempts(accountId, unitId) {
    return (await this.repo(UnitReviewAttemptEntity)).find({
      where: unitId ? { accountId, unitId } : { accountId },
      order: { unitId: 'ASC', attemptNumber: 'ASC' },
    });
  }

  async createReviewAttempt(attempt) {
    const repository = await this.repo(UnitReviewAttemptEntity);
    for (let tries = 0; ; tries++) {
      try {
        return await repository.save({ ...attempt, attemptNumber: attempt.attemptNumber + tries });
      } catch (error) {
        if (error?.code !== '23505' || tries >= 5) throw error;
      }
    }
  }

  async listRanking(lessonId) {
    return (await this.repo(LessonTestAttemptEntity)).find({
      where: { lessonId, attemptNumber: 1, status: 'COMPLETED' },
      order: { correctCount: 'DESC', durationSeconds: 'ASC', submittedAt: 'ASC' },
    });
  }
}

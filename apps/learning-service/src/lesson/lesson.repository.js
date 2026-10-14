import { LessonProgressEntity, LessonTestAttemptEntity } from '../database/learning.entities.js';

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

  // Inserts or updates the learner's single row for a lesson.
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

  // The learner's attempts at one lesson test, oldest first.
  async listAttempts(accountId, lessonId) {
    return (await this.repo(LessonTestAttemptEntity)).find({
      where: { accountId, lessonId },
      order: { attemptNumber: 'ASC' },
    });
  }

  // Every finished attempt of the learner, for the best score per lesson.
  async listCompletedAttempts(accountId) {
    return (await this.repo(LessonTestAttemptEntity)).find({
      where: { accountId, status: 'COMPLETED' },
      select: { lessonId: true, correctCount: true, totalCount: true },
    });
  }

  // Returns null when the attempt already exists, e.g. two starts racing.
  async createAttempt(attempt) {
    try {
      return await (await this.repo(LessonTestAttemptEntity)).save(attempt);
    } catch (error) {
      if (error?.code === '23505') return null; // unique violation
      throw error;
    }
  }

  async saveAttempt(attempt) {
    return (await this.repo(LessonTestAttemptEntity)).save(attempt);
  }

  // Removes an attempt the learner left without submitting (D82). Only an
  // attempt still in progress goes, so a submit racing it is kept.
  async deleteOpenAttempt(id) {
    await (await this.repo(LessonTestAttemptEntity)).delete({ id, status: 'IN_PROGRESS' });
  }

  // First attempts of a lesson, best first: more right answers, then less
  // time, then the earlier submit (D30, D36).
  async listRanking(lessonId) {
    return (await this.repo(LessonTestAttemptEntity)).find({
      where: { lessonId, attemptNumber: 1, status: 'COMPLETED' },
      order: { correctCount: 'DESC', durationSeconds: 'ASC', submittedAt: 'ASC' },
    });
  }
}

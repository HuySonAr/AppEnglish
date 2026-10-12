import { MockAttemptEntity, ScoreConversionEntity } from '../database/learning.entities.js';

export class MockRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  // The learner's finished attempts at every mock test, without the answers.
  async listFinishedAttempts(accountId) {
    return (await this.repo(MockAttemptEntity)).find({
      where: { accountId, status: 'COMPLETED' },
      select: {
        id: true, mockTestId: true, kind: true, partKey: true, attemptNumber: true,
        correctCount: true, totalCount: true, listeningScore: true, readingScore: true, submittedAt: true,
      },
      order: { submittedAt: 'ASC' },
    });
  }

  // The learner's attempts at one mock test (full and mini), oldest first.
  async listTestAttempts(accountId, mockTestId) {
    return (await this.repo(MockAttemptEntity)).find({
      where: { accountId, mockTestId },
      order: { attemptNumber: 'ASC' },
    });
  }

  // Returns null when the attempt already exists, e.g. two starts racing.
  async createAttempt(attempt) {
    try {
      return await (await this.repo(MockAttemptEntity)).save(attempt);
    } catch (error) {
      if (error?.code === '23505') return null; // unique violation
      throw error;
    }
  }

  async saveAttempt(attempt) {
    return (await this.repo(MockAttemptEntity)).save(attempt);
  }

  async findConversion() {
    return (await this.repo(ScoreConversionEntity)).findOne({ where: { id: 1 } });
  }

  async saveConversion(conversion) {
    return (await this.repo(ScoreConversionEntity)).save({ ...conversion, id: 1 });
  }
}

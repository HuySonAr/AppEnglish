import { LearnerGoalEntity, MockAttemptEntity, MockReviewAnswerEntity, ScoreConversionEntity } from '../database/learning.entities.js';

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

  async listRecentAttempts(accountId, limit) {
    return (await this.repo(MockAttemptEntity)).find({
      where: { accountId, status: 'COMPLETED' },
      select: { id: true, mockTestId: true, mockVersionId: true, kind: true, partKey: true, answers: true, submittedAt: true },
      order: { submittedAt: 'DESC' },
      take: limit,
    });
  }

  async listCompletedAttempts(accountId) {
    return (await this.repo(MockAttemptEntity)).find({
      where: { accountId, status: 'COMPLETED' },
      select: { id: true, mockTestId: true, mockVersionId: true, kind: true, partKey: true, answers: true, submittedAt: true },
      order: { submittedAt: 'ASC' },
    });
  }

  async listReviewAnswers(accountId) {
    return (await this.repo(MockReviewAnswerEntity)).find({ where: { accountId }, order: { answeredAt: 'ASC' } });
  }

  async saveReviewAnswer(answer) {
    return (await this.repo(MockReviewAnswerEntity)).save(answer);
  }

  async findGoal(accountId) {
    return (await this.repo(LearnerGoalEntity)).findOne({ where: { accountId } });
  }

  async saveGoal(goal) {
    return (await this.repo(LearnerGoalEntity)).save(goal);
  }

  async deleteGoal(accountId) {
    await (await this.repo(LearnerGoalEntity)).delete({ accountId });
  }

  async listCompletedTestAttempts(mockTestId) {
    return (await this.repo(MockAttemptEntity)).find({
      where: { mockTestId, status: 'COMPLETED' },
      select: { id: true, accountId: true, mockVersionId: true, kind: true, partKey: true, answers: true, listeningScore: true, readingScore: true },
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

  // Removes an attempt the learner left without submitting (D82). Only an
  // attempt still in progress goes, so a submit racing it is kept.
  async deleteOpenAttempt(id) {
    await (await this.repo(MockAttemptEntity)).delete({ id, status: 'IN_PROGRESS' });
  }

  async findConversion() {
    return (await this.repo(ScoreConversionEntity)).findOne({ where: { id: 1 } });
  }

  async saveConversion(conversion) {
    return (await this.repo(ScoreConversionEntity)).save({ ...conversion, id: 1 });
  }
}

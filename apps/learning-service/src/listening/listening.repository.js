import { ListeningResultEntity } from '../database/learning.entities.js';

export class ListeningRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(ListeningResultEntity);
  }

  // Every result of the learner; with exerciseId, those of one exercise (one
  // per mode).
  async listResults(accountId, exerciseId) {
    return (await this.repo()).find({ where: exerciseId ? { accountId, exerciseId } : { accountId } });
  }

  async findResult(accountId, exerciseId, mode) {
    return (await this.repo()).findOne({ where: { accountId, exerciseId, mode } });
  }

  // Records one check in a single statement, so two checks at once both
  // count and the best accuracy is never lowered.
  async recordCheck(accountId, exerciseId, mode, accuracy, checkedAt) {
    const repository = await this.repo();
    await repository.query(
      `INSERT INTO "listening_results" ("accountId", "exerciseId", "mode", "bestAccuracy", "lastAccuracy", "checkCount", "lastCheckedAt")
       VALUES ($1, $2, $3, $4, $4, 1, $5)
       ON CONFLICT ("accountId", "exerciseId", "mode") DO UPDATE SET
         "bestAccuracy" = GREATEST("listening_results"."bestAccuracy", EXCLUDED."bestAccuracy"),
         "lastAccuracy" = EXCLUDED."lastAccuracy",
         "checkCount" = "listening_results"."checkCount" + 1,
         "lastCheckedAt" = EXCLUDED."lastCheckedAt",
         "updatedAt" = now()`,
      [accountId, exerciseId, mode, accuracy, checkedAt],
    );
    return this.findResult(accountId, exerciseId, mode);
  }
}

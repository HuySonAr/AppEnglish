import { LessonCompletionEntity, SkillResultEntity, XpLedgerEntity } from '../database/progress.entities.js';

export class ProgressRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  // Keeps one finished test; the same attempt reported again changes nothing.
  async saveResult(result) {
    await (await this.repo(SkillResultEntity)).createQueryBuilder().insert().values(result).orIgnore().execute();
  }

  async listResults(accountId) {
    return (await this.repo(SkillResultEntity)).find({ where: { accountId }, order: { submittedAt: 'ASC' } });
  }

  // Keeps the first completion of a lesson; a later report changes nothing.
  async saveCompletion(completion) {
    await (await this.repo(LessonCompletionEntity)).createQueryBuilder().insert().values(completion).orIgnore().execute();
  }

  async listCompletions(accountId) {
    return (await this.repo(LessonCompletionEntity)).find({ where: { accountId } });
  }

  // Keeps the XP of a mock test; a second row for the same learner and test
  // (or the same attempt) changes nothing.
  async saveXp(entry) {
    await (await this.repo(XpLedgerEntity)).createQueryBuilder().insert().values(entry).orIgnore().execute();
  }

  async listXp(accountId) {
    return (await this.repo(XpLedgerEntity)).find({ where: { accountId }, order: { earnedAt: 'DESC' } });
  }

  // Every learner's total XP, when they reached it (their last gain) and the
  // email of that gain, unranked.
  async listXpTotals() {
    const repository = await this.repo(XpLedgerEntity);
    const rows = await repository.query(`
      SELECT l."accountId", SUM(l."xp")::int AS "totalXp", COUNT(*)::int AS "mockCount", MAX(l."earnedAt") AS "reachedAt",
        (SELECT e."accountEmail" FROM "xp_ledger" e WHERE e."accountId" = l."accountId" ORDER BY e."earnedAt" DESC LIMIT 1) AS "accountEmail"
      FROM "xp_ledger" l
      GROUP BY l."accountId"
    `);
    return rows.map((row) => ({ ...row, reachedAt: new Date(row.reachedAt) }));
  }
}

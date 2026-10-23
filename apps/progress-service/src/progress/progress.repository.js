import { IsNull, LessThan } from 'typeorm';
import { LessonCompletionEntity, NotificationEntity, ProcessedMessageEntity, SkillResultEntity, StudyDayEntity, XpLedgerEntity } from '../database/progress.entities.js';

export class ProgressRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async saveResult(result) {
    await (await this.repo(SkillResultEntity)).createQueryBuilder().insert().values(result).orIgnore().execute();
  }

  async listResults(accountId) {
    return (await this.repo(SkillResultEntity)).find({ where: { accountId }, order: { submittedAt: 'ASC' } });
  }

  async saveCompletion(completion) {
    await (await this.repo(LessonCompletionEntity)).createQueryBuilder().insert().values(completion).orIgnore().execute();
  }

  async listCompletions(accountId) {
    return (await this.repo(LessonCompletionEntity)).find({ where: { accountId } });
  }

  async saveXp(entry) {
    await (await this.repo(XpLedgerEntity)).createQueryBuilder().insert().values(entry).orIgnore().execute();
  }

  async isProcessed(messageId) {
    return Boolean(await (await this.repo(ProcessedMessageEntity)).findOne({ where: { messageId } }));
  }

  async markProcessed(messageId, queue, at) {
    await (await this.repo(ProcessedMessageEntity)).createQueryBuilder().insert().values({ messageId, queue, processedAt: at }).orIgnore().execute();
  }

  async addNotification(notification) {
    await (await this.repo(NotificationEntity)).createQueryBuilder().insert().values(notification).orIgnore().execute();
  }

  async latestMockNotification(accountId, mockTestId) {
    return (await this.repo(NotificationEntity))
      .createQueryBuilder('n')
      .where('n.accountId = :accountId AND n.kind = :kind AND n.data ->> \'mockTestId\' = :mockTestId', { accountId, kind: 'MOCK_RESULT', mockTestId })
      .orderBy('n.createdAt', 'DESC')
      .getOne();
  }

  async listNotifications(accountId, limit) {
    return (await this.repo(NotificationEntity)).find({ where: { accountId }, order: { createdAt: 'DESC' }, take: limit });
  }

  async countUnread(accountId) {
    return (await this.repo(NotificationEntity)).count({ where: { accountId, readAt: IsNull() } });
  }

  async markNotificationsRead(accountId, ids, at) {
    const query = (await this.repo(NotificationEntity)).createQueryBuilder().update().set({ readAt: at }).where('"accountId" = :accountId AND "readAt" IS NULL', { accountId });
    if (ids) query.andWhere('id IN (:...ids)', { ids: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] });
    await query.execute();
  }

  async markNotificationKeyRead(accountId, key, at) {
    await (await this.repo(NotificationEntity)).update({ accountId, key, readAt: IsNull() }, { readAt: at });
  }

  async deleteNotificationsBefore(accountId, before) {
    await (await this.repo(NotificationEntity)).delete({ accountId, createdAt: LessThan(before) });
  }

  async saveStudyDay({ accountId, day, activity, at }) {
    const repository = await this.repo(StudyDayEntity);
    await repository.query(
      `INSERT INTO "study_days" ("accountId", "day", "activities", "firstAt", "lastAt")
       VALUES ($1, $2, jsonb_build_array($3::text), $4, $4)
       ON CONFLICT ("accountId", "day") DO UPDATE SET
         "activities" = CASE WHEN "study_days"."activities" ? $3 THEN "study_days"."activities" ELSE "study_days"."activities" || jsonb_build_array($3::text) END,
         "firstAt" = LEAST("study_days"."firstAt", EXCLUDED."firstAt"),
         "lastAt" = GREATEST("study_days"."lastAt", EXCLUDED."lastAt")`,
      [accountId, day, activity, at],
    );
  }

  async listStudyDays(accountId) {
    const rows = await (await this.repo(StudyDayEntity)).query(`SELECT to_char("day", 'YYYY-MM-DD') AS "day" FROM "study_days" WHERE "accountId" = $1 ORDER BY "day"`, [accountId]);
    return rows.map((row) => row.day);
  }

  async listXp(accountId) {
    return (await this.repo(XpLedgerEntity)).find({ where: { accountId }, order: { earnedAt: 'DESC' } });
  }

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

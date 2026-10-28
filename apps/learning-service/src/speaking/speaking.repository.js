import { In, IsNull, LessThan, Not } from 'typeorm';
import { LearningEventEntity, PracticeSubmissionEntity } from '../database/learning.entities.js';

export class SpeakingRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async source() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource;
  }

  async repo() {
    return (await this.source()).getRepository(PracticeSubmissionEntity);
  }

  async statsByPrompt(accountId) {
    const rows = await (await this.repo()).query(
      `SELECT "promptId", count(*)::int AS "attempts", max(COALESCE(("teacherReview"->'scores'->>'total')::float, ("result"->'scores'->>'total')::float)) AS "bestTotal", max("submittedAt") AS "lastSubmittedAt"
       FROM "practice_submissions" WHERE "accountId" = $1 GROUP BY "promptId"`,
      [accountId],
    );
    return rows.map((row) => ({ ...row, bestTotal: row.bestTotal === null ? null : Number(row.bestTotal) }));
  }

  async listSubmissions(accountId, promptId, limit) {
    return (await this.repo()).find({ where: { accountId, promptId }, order: { submittedAt: 'DESC' }, take: limit });
  }

  async listScored(accountId, kinds) {
    return (await this.repo()).find({
      where: { accountId, kind: In(kinds), status: In(['DONE', 'FAILED', 'SAVED']) },
      select: { id: true, kind: true, prompt: true, result: true, teacherReview: true, submittedAt: true, status: true },
      order: { submittedAt: 'DESC' },
    });
  }

  async listAllSubmissions(accountId, promptId) {
    return (await this.repo()).find({ where: { accountId, promptId } });
  }

  async deleteSubmissions(ids) {
    if (ids.length) await (await this.repo()).delete({ id: In(ids) });
  }

  async findSubmission(id) {
    return (await this.repo()).findOne({ where: { id } });
  }

  async saveWithEvent(submission, event) {
    return (await this.source()).transaction(async (manager) => {
      const saved = await manager.getRepository(PracticeSubmissionEntity).save(submission);
      if (event) await manager.getRepository(LearningEventEntity).save(event);
      return saved;
    });
  }

  async listExpiredRecordings(before, limit) {
    return (await this.repo()).find({
      where: { recordingDeletedAt: IsNull(), recording: Not(IsNull()), submittedAt: LessThan(before) },
      order: { submittedAt: 'ASC' },
      take: limit,
    });
  }

  async markRecordingsDeleted(ids, at) {
    if (ids.length) await (await this.repo()).update({ id: In(ids) }, { recordingDeletedAt: at });
  }
}

import { In } from 'typeorm';
import { LearningEventEntity, PracticeSubmissionEntity, ReviewRequestEntity } from '../database/learning.entities.js';

export class ReviewRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async source() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource;
  }

  async repo() {
    return (await this.source()).getRepository(ReviewRequestEntity);
  }

  async findBySubmission(submissionId) {
    return (await this.repo()).findOne({ where: { submissionId } });
  }

  async findBySubmissions(submissionIds) {
    return submissionIds.length ? (await this.repo()).find({ where: { submissionId: In(submissionIds) } }) : [];
  }

  async findReview(id) {
    return (await this.repo()).findOne({ where: { id } });
  }

  async countUsed(accountId, weekStart) {
    return (await this.repo()).count({ where: { accountId, weekStart, status: In(['WAITING', 'DONE']) } });
  }

  async reserve(row, limit) {
    return (await this.source()).transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`review:${row.accountId}`]);
      const used = await manager.count(ReviewRequestEntity, { where: { accountId: row.accountId, weekStart: row.weekStart, status: In(['WAITING', 'DONE']) } });
      if (used >= limit) return null;
      const existing = await manager.findOne(ReviewRequestEntity, { where: { submissionId: row.submissionId } });
      return manager.save(ReviewRequestEntity, existing ? { ...existing, ...row, id: existing.id } : row);
    });
  }

  async withdraw(submissionId, accountId, now) {
    const result = await (await this.repo())
      .createQueryBuilder()
      .delete()
      .where('"submissionId" = :submissionId AND "accountId" = :accountId AND "status" = :status AND ("lockedUntil" IS NULL OR "lockedUntil" <= :now)', { submissionId, accountId, status: 'WAITING', now })
      .execute();
    return Boolean(result.affected);
  }

  async listWaiting(now) {
    return (await this.repo())
      .createQueryBuilder('r')
      .where('r.status = :status AND r.expiresAt > :now', { status: 'WAITING', now })
      .orderBy('r.requestedAt', 'ASC')
      .getMany();
  }

  async countDoneSince(teacherId, since) {
    return (await this.repo()).createQueryBuilder('r').where('r.teacherId = :teacherId AND r.status = :status AND r.completedAt >= :since', { teacherId, status: 'DONE', since }).getCount();
  }

  async claim(id, teacherId, now, until) {
    const rows = await (await this.repo()).query(
      `UPDATE "review_requests" SET "teacherId" = $2, "claimedAt" = CASE WHEN "teacherId" = $2 AND "lockedUntil" > $3 THEN "claimedAt" ELSE $3 END, "lockedUntil" = $4, "updatedAt" = now()
       WHERE "id" = $1 AND "status" = 'WAITING' AND "expiresAt" > $3 AND ("lockedUntil" IS NULL OR "lockedUntil" <= $3 OR "teacherId" = $2)
       RETURNING "id"`,
      [id, teacherId, now, until],
    );
    return rows.length ? this.findReview(id) : null;
  }

  async release(id, teacherId) {
    await (await this.repo()).update({ id, teacherId, status: 'WAITING' }, { lockedUntil: null });
  }

  async findSubmission(id) {
    return (await this.source()).getRepository(PracticeSubmissionEntity).findOne({ where: { id } });
  }

  async complete(review, submission, event) {
    return (await this.source()).transaction(async (manager) => {
      const saved = await manager.save(ReviewRequestEntity, review);
      await manager.update(PracticeSubmissionEntity, { id: submission.id }, { teacherReview: submission.teacherReview });
      await manager.save(LearningEventEntity, event);
      return saved;
    });
  }

  async listExpired(now, limit = 100) {
    return (await this.repo())
      .createQueryBuilder('r')
      .where('r.status = :status AND r.expiresAt <= :now AND (r.lockedUntil IS NULL OR r.lockedUntil <= :now)', { status: 'WAITING', now })
      .orderBy('r.requestedAt', 'ASC')
      .take(limit)
      .getMany();
  }

  async expire(review, event) {
    return (await this.source()).transaction(async (manager) => {
      const result = await manager.update(ReviewRequestEntity, { id: review.id, status: 'WAITING' }, { status: 'EXPIRED', lockedUntil: null });
      if (result.affected) await manager.save(LearningEventEntity, event);
      return Boolean(result.affected);
    });
  }
}

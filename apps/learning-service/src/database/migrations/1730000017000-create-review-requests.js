export class CreateReviewRequests1730000017000 {
  name = 'CreateReviewRequests1730000017000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "review_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "submissionId" uuid NOT NULL,
        "accountId" uuid NOT NULL,
        "kind" varchar(20) NOT NULL,
        "weekStart" date NOT NULL,
        "status" varchar(10) NOT NULL CHECK ("status" IN ('WAITING', 'DONE', 'EXPIRED')),
        "requestedAt" timestamptz NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "teacherId" uuid,
        "claimedAt" timestamptz,
        "lockedUntil" timestamptz,
        "completedAt" timestamptz,
        "action" varchar(14) CHECK ("action" IN ('CONFIRM', 'EDIT', 'FROM_SCRATCH')),
        "before" jsonb,
        "after" jsonb,
        "note" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_review_requests_submission" ON "review_requests" ("submissionId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_review_requests_queue" ON "review_requests" ("status", "requestedAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_review_requests_week" ON "review_requests" ("accountId", "weekStart")');
    await queryRunner.query('ALTER TABLE "practice_submissions" ADD COLUMN IF NOT EXISTS "teacherReview" jsonb');
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "practice_submissions" DROP COLUMN IF EXISTS "teacherReview"');
    await queryRunner.query('DROP TABLE IF EXISTS "review_requests"');
  }
}

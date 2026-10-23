export class CreateUnitReviewAttempts1730000010000 {
  name = 'CreateUnitReviewAttempts1730000010000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "unit_review_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "unitId" uuid NOT NULL,
        "reviewVersionId" uuid NOT NULL,
        "attemptNumber" int NOT NULL,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "totalCount" int NOT NULL,
        "correctCount" int NOT NULL,
        "passed" boolean NOT NULL,
        "submittedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_unit_review_attempts_number" UNIQUE ("accountId", "unitId", "attemptNumber")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_unit_review_attempts_account" ON "unit_review_attempts" ("accountId", "unitId")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "unit_review_attempts"');
  }
}

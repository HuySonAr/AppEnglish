export class CreateSwAttempts1730000021000 {
  name = 'CreateSwAttempts1730000021000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sw_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "testId" uuid NOT NULL,
        "versionId" uuid NOT NULL,
        "section" varchar(16) NOT NULL CHECK ("section" IN ('speaking', 'writing')),
        "attemptNumber" int NOT NULL,
        "status" varchar(16) NOT NULL CHECK ("status" IN ('IN_PROGRESS', 'SUBMITTED')),
        "startedAt" timestamptz NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "submittedAt" timestamptz,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "recordings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "lockedThrough" int NOT NULL DEFAULT 0,
        "recordingDeletedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_sw_attempts_account_test" ON "sw_attempts" ("accountId", "testId", "section")');
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sw_attempts_open" ON "sw_attempts" ("accountId", "testId", "section") WHERE "status" = 'IN_PROGRESS'`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "sw_attempts"');
  }
}

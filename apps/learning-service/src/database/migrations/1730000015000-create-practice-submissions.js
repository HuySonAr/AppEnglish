export class CreatePracticeSubmissions1730000015000 {
  name = 'CreatePracticeSubmissions1730000015000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "practice_submissions" (
        "id" uuid NOT NULL PRIMARY KEY,
        "accountId" uuid NOT NULL,
        "promptId" uuid NOT NULL,
        "promptVersionId" uuid NOT NULL,
        "kind" varchar(20) NOT NULL,
        "prompt" jsonb NOT NULL,
        "recording" jsonb,
        "recordingDeletedAt" timestamptz,
        "status" varchar(12) NOT NULL CHECK ("status" IN ('SCORING', 'DONE', 'FAILED')),
        "result" jsonb,
        "error" varchar(500),
        "submittedAt" timestamptz NOT NULL,
        "scoredAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_practice_submissions_account" ON "practice_submissions" ("accountId", "promptId", "submittedAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_practice_submissions_recordings" ON "practice_submissions" ("recordingDeletedAt", "submittedAt")');
    await queryRunner.query('ALTER TABLE "learning_events" ADD COLUMN IF NOT EXISTS "queue" varchar(60)');
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "learning_events" DROP COLUMN IF EXISTS "queue"');
    await queryRunner.query('DROP TABLE IF EXISTS "practice_submissions"');
  }
}

export class CreateAiKeysAndWriting1730000016000 {
  name = 'CreateAiKeysAndWriting1730000016000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_keys" (
        "accountId" uuid NOT NULL PRIMARY KEY,
        "provider" varchar(20) NOT NULL DEFAULT 'gemini',
        "sealed" jsonb NOT NULL,
        "last4" varchar(4) NOT NULL,
        "verifiedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('ALTER TABLE "practice_submissions" ADD COLUMN IF NOT EXISTS "answer" text');
    await queryRunner.query('ALTER TABLE "practice_submissions" DROP CONSTRAINT IF EXISTS "practice_submissions_status_check"');
    await queryRunner.query(`ALTER TABLE "practice_submissions" ADD CONSTRAINT "practice_submissions_status_check" CHECK ("status" IN ('SCORING', 'DONE', 'FAILED', 'SAVED'))`);
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "practice_submissions" DROP CONSTRAINT IF EXISTS "practice_submissions_status_check"');
    await queryRunner.query(`ALTER TABLE "practice_submissions" ADD CONSTRAINT "practice_submissions_status_check" CHECK ("status" IN ('SCORING', 'DONE', 'FAILED'))`);
    await queryRunner.query('ALTER TABLE "practice_submissions" DROP COLUMN IF EXISTS "answer"');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_keys"');
  }
}

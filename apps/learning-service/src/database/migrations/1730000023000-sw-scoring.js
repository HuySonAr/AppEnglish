export class SwScoring1730000023000 {
  name = 'SwScoring1730000023000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "sw_attempts" ADD COLUMN IF NOT EXISTS "scoring" jsonb');
    await queryRunner.query('ALTER TABLE "sw_attempts" ADD COLUMN IF NOT EXISTS "teacherReview" jsonb');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sw_score_jobs" (
        "id" uuid PRIMARY KEY,
        "attemptId" uuid NOT NULL REFERENCES "sw_attempts" ("id") ON DELETE CASCADE,
        "number" int NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_sw_score_jobs_attempt" ON "sw_score_jobs" ("attemptId")');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sw_score_conversion" (
        "id" int PRIMARY KEY,
        "speaking" jsonb NOT NULL,
        "writing" jsonb NOT NULL,
        "updatedBy" uuid,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "sw_score_conversion"');
    await queryRunner.query('DROP TABLE IF EXISTS "sw_score_jobs"');
    await queryRunner.query('ALTER TABLE "sw_attempts" DROP COLUMN IF EXISTS "teacherReview"');
    await queryRunner.query('ALTER TABLE "sw_attempts" DROP COLUMN IF EXISTS "scoring"');
  }
}

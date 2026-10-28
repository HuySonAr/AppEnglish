export class PracticeTimingJobs1720000026000 {
  name = 'PracticeTimingJobs1720000026000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "practicePromptId" uuid REFERENCES "practice_prompts" ("id") ON DELETE CASCADE');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "mockTestId", "practicePromptId") = 1)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_listening_timing_jobs_practice_prompt" ON "listening_timing_jobs" ("practicePromptId", "createdAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DELETE FROM "listening_timing_jobs" WHERE "practicePromptId" IS NOT NULL');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listening_timing_jobs_practice_prompt"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "mockTestId") = 1)');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "practicePromptId"');
  }
}

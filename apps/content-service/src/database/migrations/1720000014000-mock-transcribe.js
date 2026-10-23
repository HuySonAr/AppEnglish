export class MockTranscribe1720000014000 {
  name = 'MockTranscribe1720000014000';

  async up(queryRunner) {
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "mockTestId" uuid REFERENCES "mock_tests" ("id") ON DELETE CASCADE',
    );
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "audioMediaId" uuid');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "courseItemId", "mockTestId") = 1)',
    );
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_listening_timing_jobs_mock_test" ON "listening_timing_jobs" ("mockTestId", "createdAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DELETE FROM "listening_timing_jobs" WHERE "mockTestId" IS NOT NULL');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listening_timing_jobs_mock_test"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "courseItemId") = 1)',
    );
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "audioMediaId"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "mockTestId"');
  }
}

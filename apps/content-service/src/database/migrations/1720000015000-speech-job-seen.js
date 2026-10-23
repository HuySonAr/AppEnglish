export class SpeechJobSeen1720000015000 {
  name = 'SpeechJobSeen1720000015000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "seenAt" timestamptz');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_listening_timing_jobs_requester" ON "listening_timing_jobs" ("requestedBy", "updatedAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listening_timing_jobs_requester"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "seenAt"');
  }
}

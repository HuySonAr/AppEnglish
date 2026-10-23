export class ListeningTimingJobTask1720000007000 {
  name = 'ListeningTimingJobTask1720000007000';

  async up(queryRunner) {
    await queryRunner.query(`ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "task" varchar(16) NOT NULL DEFAULT 'align' CHECK ("task" IN ('align', 'transcribe'))`);
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "task"');
  }
}

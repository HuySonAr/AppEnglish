// Auto-time (D97): the requests for the times of a listening exercise's lines,
// answered by speech-service through RabbitMQ.
export class CreateListeningTimingJobs1720000006000 {
  name = 'CreateListeningTimingJobs1720000006000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_timing_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "exerciseId" uuid NOT NULL REFERENCES "listening_exercises" ("id"),
        "status" varchar(16) NOT NULL CHECK ("status" IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED')),
        "lines" jsonb NOT NULL,
        "result" jsonb,
        "error" text,
        "requestedBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_listening_timing_jobs_exercise" ON "listening_timing_jobs" ("exerciseId", "createdAt")`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "listening_timing_jobs"');
  }
}

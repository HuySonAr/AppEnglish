// Outbox of the results sent to progress-service over RabbitMQ (F06, D110).
// A row is written with the result it reports and relayed afterwards, so a
// result is not lost while the broker is away.
export class CreateLearningEvents1730000009000 {
  name = 'CreateLearningEvents1730000009000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "learning_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar(40) NOT NULL,
        "payload" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "publishedAt" timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_learning_events_pending" ON "learning_events" ("publishedAt", "createdAt")',
    );
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "learning_events"');
  }
}

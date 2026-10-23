export class CreateContentEvents1720000017000 {
  name = 'CreateContentEvents1720000017000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "type" varchar(40) NOT NULL,
        "payload" jsonb NOT NULL,
        "requestId" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "publishedAt" timestamptz
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_content_events_pending" ON "content_events" ("publishedAt", "createdAt")');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "processed_messages" (
        "messageId" varchar(64) NOT NULL PRIMARY KEY,
        "queue" varchar(80) NOT NULL,
        "processedAt" timestamptz NOT NULL
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "processed_messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "content_events"');
  }
}

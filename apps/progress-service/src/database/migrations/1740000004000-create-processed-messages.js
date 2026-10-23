export class CreateProcessedMessages1740000004000 {
  name = 'CreateProcessedMessages1740000004000';

  async up(queryRunner) {
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
  }
}

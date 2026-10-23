export class CreateNotifications1740000003000 {
  name = 'CreateNotifications1740000003000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "accountId" uuid NOT NULL,
        "kind" varchar(32) NOT NULL,
        "key" varchar(120) NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL,
        "readAt" timestamptz,
        CONSTRAINT "UQ_notifications_account_key" UNIQUE ("accountId", "key")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_notifications_account_created" ON "notifications" ("accountId", "createdAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "notifications"');
  }
}

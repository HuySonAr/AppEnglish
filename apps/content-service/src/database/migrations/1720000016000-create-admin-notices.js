export class CreateAdminNotices1720000016000 {
  name = 'CreateAdminNotices1720000016000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_notices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "kind" varchar(32) NOT NULL,
        "key" varchar(160) NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL,
        CONSTRAINT "UQ_admin_notices_key" UNIQUE ("key")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_admin_notices_created" ON "admin_notices" ("createdAt")');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_notice_reads" (
        "accountId" uuid NOT NULL,
        "key" varchar(160) NOT NULL,
        "readAt" timestamptz NOT NULL,
        PRIMARY KEY ("accountId", "key")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "admin_notice_reads"');
    await queryRunner.query('DROP TABLE IF EXISTS "admin_notices"');
  }
}

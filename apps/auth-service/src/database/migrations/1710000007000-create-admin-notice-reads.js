export class CreateAdminNoticeReads1710000007000 {
  name = 'CreateAdminNoticeReads1710000007000';

  async up(queryRunner) {
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
  }
}

export class CreateAccountAudits1710000003000 {
  name = 'CreateAccountAudits1710000003000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_audits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorId" uuid NOT NULL,
        "targetAccountId" uuid NOT NULL,
        "action" varchar(32) NOT NULL,
        "previousRole" varchar(32),
        "nextRole" varchar(32),
        "previousStatus" varchar(32),
        "nextStatus" varchar(32),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_account_audits_target" ON "account_audits" ("targetAccountId", "createdAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_account_audits_actor" ON "account_audits" ("actorId", "createdAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_account_audits_actor"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_account_audits_target"');
    await queryRunner.query('DROP TABLE IF EXISTS "account_audits"');
  }
}

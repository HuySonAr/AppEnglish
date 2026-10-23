export class CreateXpLedger1740000001000 {
  name = 'CreateXpLedger1740000001000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "xp_ledger" (
        "id" uuid PRIMARY KEY,
        "accountId" uuid NOT NULL,
        "accountEmail" varchar(320) NOT NULL DEFAULT '',
        "mockTestId" uuid NOT NULL,
        "mockTestTitle" varchar(200) NOT NULL DEFAULT '',
        "correctCount" int NOT NULL,
        "totalCount" int NOT NULL,
        "xp" int NOT NULL CHECK ("xp" BETWEEN 0 AND 100),
        "earnedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_xp_ledger_account_mock" UNIQUE ("accountId", "mockTestId")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_xp_ledger_account" ON "xp_ledger" ("accountId")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "xp_ledger"');
  }
}

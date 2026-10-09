export class CreateRefreshTokens1710000001000 {
  name = 'CreateRefreshTokens1710000001000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "familyId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "revokedAt" timestamptz NULL,
        "replacedByHash" varchar(64) NULL
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_account_id" ON "refresh_tokens" ("accountId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("familyId")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_family_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_account_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "refresh_tokens"');
  }
}

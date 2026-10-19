// F01B admin management (D114): last sign-in and the reason an account is
// locked on accounts; the reason of each audit row. Append-only.
export class AddAccountAdminFields1710000005000 {
  name = 'AddAccountAdminFields1710000005000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamptz');
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "statusReason" text');
    await queryRunner.query('ALTER TABLE "account_audits" ADD COLUMN IF NOT EXISTS "reason" text');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_accounts_created_at" ON "accounts" ("createdAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_accounts_last_login_at" ON "accounts" ("lastLoginAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_accounts_last_login_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_accounts_created_at"');
    await queryRunner.query('ALTER TABLE "account_audits" DROP COLUMN IF EXISTS "reason"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "statusReason"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "lastLoginAt"');
  }
}

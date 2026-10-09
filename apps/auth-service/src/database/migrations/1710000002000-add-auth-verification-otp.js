export class AddAuthVerificationOtp1710000002000 {
  name = 'AddAuthVerificationOtp1710000002000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamptz NULL');
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 0');
    await queryRunner.query('ALTER TABLE "accounts" ALTER COLUMN "status" SET DEFAULT \'PENDING_VERIFICATION\'');
    await queryRunner.query('ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_status_check"');
    await queryRunner.query('ALTER TABLE "accounts" ADD CONSTRAINT "accounts_status_check" CHECK ("status" IN (\'PENDING_VERIFICATION\',\'ACTIVE\',\'DISABLED\',\'SUSPENDED\'))');
    await queryRunner.query('UPDATE "accounts" SET "status" = \'PENDING_VERIFICATION\' WHERE "status" = \'ACTIVE\' AND "emailVerifiedAt" IS NULL');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otp_challenges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "purpose" varchar(32) NOT NULL,
        "codeHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "resendAfter" timestamptz NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "usedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_otp_account_purpose" ON "otp_challenges" ("accountId", "purpose")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_otp_created_at" ON "otp_challenges" ("createdAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "otp_challenges"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "sessionVersion"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "emailVerifiedAt"');
  }
}

// F09 profile (D113): display name and avatar on the account. Append-only.
export class AddAccountProfile1710000004000 {
  name = 'AddAccountProfile1710000004000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "displayName" varchar(50)');
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "avatarUrl" text');
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "avatarStorage" varchar(16)');
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "avatarStorageId" varchar(128)');
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "avatarStorageId"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "avatarStorage"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "avatarUrl"');
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "displayName"');
  }
}

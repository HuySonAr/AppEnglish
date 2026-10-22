// Invitations (D131): when an admin created the account; null for
// self-registered accounts. Append-only.
export class AddAccountInvitedAt1710000006000 {
  name = 'AddAccountInvitedAt1710000006000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "invitedAt" timestamptz');
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" DROP COLUMN IF EXISTS "invitedAt"');
  }
}

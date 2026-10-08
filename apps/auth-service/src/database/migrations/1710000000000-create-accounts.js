export class CreateAccounts1710000000000 {
  name = 'CreateAccounts1710000000000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL UNIQUE,
        "passwordHash" text NOT NULL,
        "role" varchar(32) NOT NULL DEFAULT 'STUDENT' CHECK ("role" IN ('STUDENT', 'CONTENT_MANAGER', 'ADMIN')),
        "status" varchar(32) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'DISABLED')),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "accounts"');
  }
}

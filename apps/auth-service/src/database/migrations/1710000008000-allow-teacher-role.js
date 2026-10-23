export class AllowTeacherRole1710000008000 {
  name = 'AllowTeacherRole1710000008000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_role_check"');
    await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "accounts_role_check" CHECK ("role" IN ('STUDENT', 'CONTENT_MANAGER', 'TEACHER', 'ADMIN'))`);
  }

  async down(queryRunner) {
    await queryRunner.query(`UPDATE "accounts" SET "role" = 'STUDENT' WHERE "role" = 'TEACHER'`);
    await queryRunner.query('ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_role_check"');
    await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "accounts_role_check" CHECK ("role" IN ('STUDENT', 'CONTENT_MANAGER', 'ADMIN'))`);
  }
}

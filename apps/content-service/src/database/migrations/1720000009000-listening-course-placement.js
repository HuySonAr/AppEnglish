export class ListeningCoursePlacement1720000009000 {
  name = 'ListeningCoursePlacement1720000009000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "listening_course_items_type_check"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "listening_course_items_level_check"');
    await queryRunner.query('ALTER TABLE "listening_course_items" ALTER COLUMN "level" DROP NOT NULL');
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_type" CHECK ("type" IN ('unit', 'level_test', 'placement'));
        ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_level" CHECK (
          ("type" = 'placement' AND "level" IS NULL) OR ("type" <> 'placement' AND "level" IN ('A1', 'A2', 'B1', 'B2', 'C1'))
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listening_course_placement" ON "listening_course_items" ("type") WHERE "type" = 'placement'`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DELETE FROM "listening_course_versions" WHERE "itemId" IN (SELECT "id" FROM "listening_course_items" WHERE "type" = 'placement')`);
    await queryRunner.query(`DELETE FROM "listening_course_items" WHERE "type" = 'placement'`);
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_listening_course_placement"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_level"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_type"');
    await queryRunner.query('ALTER TABLE "listening_course_items" ALTER COLUMN "level" SET NOT NULL');
    await queryRunner.query(`ALTER TABLE "listening_course_items" ADD CONSTRAINT "listening_course_items_type_check" CHECK ("type" IN ('unit', 'level_test'))`);
    await queryRunner.query(`ALTER TABLE "listening_course_items" ADD CONSTRAINT "listening_course_items_level_check" CHECK ("level" IN ('A1', 'A2', 'B1', 'B2', 'C1'))`);
  }
}

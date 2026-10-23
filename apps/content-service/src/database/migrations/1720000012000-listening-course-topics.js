export class ListeningCourseTopics1720000012000 {
  name = 'ListeningCourseTopics1720000012000';

  async up(queryRunner) {
    await queryRunner.query(`
      DELETE FROM "listening_course_versions" WHERE "itemId" IN (
        SELECT "id" FROM "listening_course_items" WHERE "type" NOT IN ('level_test')
      )
    `);
    await queryRunner.query(`DELETE FROM "listening_course_items" WHERE "type" NOT IN ('level_test')`);
    await queryRunner.query(`UPDATE "listening_course_items" SET "section" = NULL`);
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_section"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_level"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_type"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "listening_course_items_type_check"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "listening_course_items_level_check"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_listening_course_placement"');
    await queryRunner.query(`
      ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_type"
        CHECK ("type" IN ('topic', 'level_test'))
    `);
    await queryRunner.query(`
      ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_level"
        CHECK (("type" = 'topic' AND "level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
            OR ("type" = 'level_test' AND "level" IN ('A1', 'A2', 'B1', 'B2', 'C1')))
    `);
    await queryRunner.query(`
      ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_section" CHECK ("section" IS NULL)
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DELETE FROM "listening_course_versions" WHERE "itemId" IN (SELECT "id" FROM "listening_course_items" WHERE "type" = 'topic')`);
    await queryRunner.query(`DELETE FROM "listening_course_items" WHERE "type" = 'topic'`);
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_section"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_level"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_type"');
    await queryRunner.query(`
      ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_type"
        CHECK ("type" IN ('unit', 'level_test', 'placement'))
    `);
    await queryRunner.query(`
      ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_level"
        CHECK (("type" = 'placement' AND "level" IS NULL) OR ("type" <> 'placement' AND "level" IN ('A1', 'A2', 'B1', 'B2', 'C1')))
    `);
    await queryRunner.query(`
      ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_section" CHECK (
        ("type" = 'unit' AND "section" IN ('social_and_travel', 'work_and_study')) OR ("type" <> 'unit' AND "section" IS NULL)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listening_course_placement" ON "listening_course_items" ("type") WHERE "type" = 'placement'`);
  }
}

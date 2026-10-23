export class ListeningCourseSection1720000010000 {
  name = 'ListeningCourseSection1720000010000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_course_items" ADD COLUMN IF NOT EXISTS "section" varchar(24)');
    await queryRunner.query(`UPDATE "listening_course_items" SET "section" = 'social_and_travel' WHERE "type" = 'unit' AND "section" IS NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listening_course_items" ADD CONSTRAINT "CK_listening_course_items_section" CHECK (
          ("type" = 'unit' AND "section" IN ('social_and_travel', 'work_and_study')) OR ("type" <> 'unit' AND "section" IS NULL)
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP CONSTRAINT IF EXISTS "CK_listening_course_items_section"');
    await queryRunner.query('ALTER TABLE "listening_course_items" DROP COLUMN IF EXISTS "section"');
  }
}

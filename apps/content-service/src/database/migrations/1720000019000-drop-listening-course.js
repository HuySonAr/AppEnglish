export class DropListeningCourse1720000019000 {
  name = 'DropListeningCourse1720000019000';

  async up(queryRunner) {
    await queryRunner.query('DELETE FROM "listening_timing_jobs" WHERE "courseItemId" IS NOT NULL');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listening_timing_jobs_course_item"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "courseItemId"');
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "mockTestId") = 1)',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "listening_course_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "listening_course_items"');
  }

  async down(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_course_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "level" varchar(2),
        "type" varchar(16) NOT NULL,
        "section" varchar(24),
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "position" int NOT NULL,
        "publishedVersionId" uuid,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CK_listening_course_items_type" CHECK ("type" IN ('topic', 'level_test')),
        CONSTRAINT "CK_listening_course_items_section" CHECK ("section" IS NULL),
        CONSTRAINT "CK_listening_course_items_level" CHECK (("type" = 'topic' AND "level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')) OR ("type" = 'level_test' AND "level" IN ('A1', 'A2', 'B1', 'B2', 'C1')))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listening_course_level_test" ON "listening_course_items" ("level") WHERE "type" = 'level_test'`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_course_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId" uuid NOT NULL REFERENCES "listening_course_items" ("id"),
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listening_course_versions_number" UNIQUE ("itemId", "versionNumber")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listening_course_versions_one_draft" ON "listening_course_versions" ("itemId") WHERE "status" = 'DRAFT'`);
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "courseItemId" uuid REFERENCES "listening_course_items" ("id") ON DELETE CASCADE',
    );
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_listening_timing_jobs_course_item" ON "listening_timing_jobs" ("courseItemId", "createdAt")');
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "courseItemId", "mockTestId") = 1)',
    );
  }
}

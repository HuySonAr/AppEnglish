export class CreateListeningCourse1720000008000 {
  name = 'CreateListeningCourse1720000008000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_course_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "level" varchar(2) NOT NULL CHECK ("level" IN ('A1', 'A2', 'B1', 'B2', 'C1')),
        "type" varchar(16) NOT NULL CHECK ("type" IN ('unit', 'level_test')),
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "position" int NOT NULL,
        "publishedVersionId" uuid,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
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
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "listening_course_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "listening_course_items"');
  }
}

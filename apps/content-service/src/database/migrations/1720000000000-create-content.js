export class CreateContent1720000000000 {
  name = 'CreateContent1720000000000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "units" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "position" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "publishedAt" timestamptz,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "unitId" uuid NOT NULL REFERENCES "units" ("id"),
        "title" varchar(200) NOT NULL,
        "position" int NOT NULL,
        "publishedVersionId" uuid,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_lessons_unit_position" ON "lessons" ("unitId", "position")');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "lessonId" uuid NOT NULL REFERENCES "lessons" ("id"),
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_versions_number" UNIQUE ("lessonId", "versionNumber")
      )
    `);
    // At most one editable draft per lesson.
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lesson_versions_one_draft" ON "lesson_versions" ("lessonId") WHERE "status" = 'DRAFT'`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "kind" varchar(16) NOT NULL CHECK ("kind" IN ('audio', 'image')),
        "storage" varchar(16) NOT NULL,
        "storageId" varchar(255) NOT NULL,
        "url" text NOT NULL,
        "fileName" varchar(255) NOT NULL,
        "mimeType" varchar(128) NOT NULL,
        "sizeBytes" int NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "media_assets"');
    await queryRunner.query('DROP TABLE IF EXISTS "lesson_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "lessons"');
    await queryRunner.query('DROP TABLE IF EXISTS "units"');
  }
}

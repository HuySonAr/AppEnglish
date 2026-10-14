// Listening practice (F05B-2, D85): topics (TOEIC created here, the only one
// with an editor), exercises with a CEFR level label and a TOEIC part kind,
// and their versions, versioned like mock tests.
export class CreateListening1720000005000 {
  name = 'CreateListening1720000005000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_topics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "name" varchar(100) NOT NULL,
        "format" varchar(20),
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listening_topics_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "listening_topics" ("code", "name", "format") VALUES ('toeic', 'TOEIC', 'toeic')
      ON CONFLICT ("code") DO NOTHING
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_exercises" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "topicId" uuid NOT NULL REFERENCES "listening_topics" ("id"),
        "title" varchar(200) NOT NULL,
        "level" varchar(2) NOT NULL CHECK ("level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
        "kind" varchar(20) NOT NULL,
        "publishedVersionId" uuid,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_exercise_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "exerciseId" uuid NOT NULL REFERENCES "listening_exercises" ("id"),
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listening_exercise_versions_number" UNIQUE ("exerciseId", "versionNumber")
      )
    `);
    // At most one editable draft per exercise.
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listening_exercise_versions_one_draft" ON "listening_exercise_versions" ("exerciseId") WHERE "status" = 'DRAFT'`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "listening_exercise_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "listening_exercises"');
    await queryRunner.query('DROP TABLE IF EXISTS "listening_topics"');
  }
}

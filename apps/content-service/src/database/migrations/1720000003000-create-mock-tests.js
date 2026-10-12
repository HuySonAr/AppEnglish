// Mock tests (F05A): full TOEIC-style tests, versioned like lessons. A
// PUBLISHED version is never updated (D40).
export class CreateMockTests1720000003000 {
  name = 'CreateMockTests1720000003000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_tests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(200) NOT NULL,
        "level" int NOT NULL CHECK ("level" BETWEEN 1 AND 3),
        "durationMinutes" int NOT NULL CHECK ("durationMinutes" BETWEEN 1 AND 300),
        "publishedVersionId" uuid,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_test_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mockTestId" uuid NOT NULL REFERENCES "mock_tests" ("id"),
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mock_test_versions_number" UNIQUE ("mockTestId", "versionNumber")
      )
    `);
    // At most one editable draft per mock test.
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mock_test_versions_one_draft" ON "mock_test_versions" ("mockTestId") WHERE "status" = 'DRAFT'`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "mock_test_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "mock_tests"');
  }
}

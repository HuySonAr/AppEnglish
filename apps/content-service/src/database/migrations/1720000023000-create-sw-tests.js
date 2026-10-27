export class CreateSwTests1720000023000 {
  name = 'CreateSwTests1720000023000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sw_tests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(200) NOT NULL,
        "publishedVersionId" uuid,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sw_test_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "swTestId" uuid NOT NULL REFERENCES "sw_tests" ("id") ON DELETE CASCADE,
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PENDING_REVIEW', 'RETURNED', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "editedBy" uuid,
        "submittedBy" uuid,
        "submittedAt" timestamptz,
        "reviewedBy" uuid,
        "reviewedAt" timestamptz,
        "reviewNote" text,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sw_test_versions_number" UNIQUE ("swTestId", "versionNumber")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sw_test_versions_one_draft" ON "sw_test_versions" ("swTestId") WHERE "status" IN ('DRAFT', 'PENDING_REVIEW', 'RETURNED')`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "sw_test_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "sw_tests"');
  }
}

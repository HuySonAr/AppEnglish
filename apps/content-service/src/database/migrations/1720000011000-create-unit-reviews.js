export class CreateUnitReviews1720000011000 {
  name = 'CreateUnitReviews1720000011000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "reviewVersionId" uuid');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "unit_review_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "unitId" uuid NOT NULL REFERENCES "units" ("id") ON DELETE CASCADE,
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_unit_review_versions_number" UNIQUE ("unitId", "versionNumber")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_unit_review_versions_one_draft" ON "unit_review_versions" ("unitId") WHERE "status" = 'DRAFT'`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "unit_review_versions"');
    await queryRunner.query('ALTER TABLE "units" DROP COLUMN IF EXISTS "reviewVersionId"');
  }
}

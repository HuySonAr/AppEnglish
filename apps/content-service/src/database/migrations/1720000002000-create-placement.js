// The single shared placement test (D05), versioned like lessons: one editable
// DRAFT row and immutable PUBLISHED rows (D40).
export class CreatePlacement1720000002000 {
  name = 'CreatePlacement1720000002000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "placement_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "versionNumber" int NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        "content" jsonb NOT NULL,
        "createdBy" uuid NOT NULL,
        "publishedBy" uuid,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_placement_versions_number" UNIQUE ("versionNumber")
      )
    `);
    // At most one editable draft.
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_placement_versions_one_draft" ON "placement_versions" ("status") WHERE "status" = 'DRAFT'`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "placement_versions"');
  }
}

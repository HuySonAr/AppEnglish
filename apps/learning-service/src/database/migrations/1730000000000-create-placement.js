// Placement attempts and settings (F03). accountId and placementVersionId
// refer to other services' data, so they have no foreign key.
export class CreatePlacement1730000000000 {
  name = 'CreatePlacement1730000000000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "placement_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "status" varchar(16) NOT NULL CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
        "placementVersionId" uuid,
        "versionNumber" int,
        "startedAt" timestamptz,
        "expiresAt" timestamptz,
        "submittedAt" timestamptz,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "totalCount" int,
        "correctCount" int,
        "listeningCorrect" int,
        "readingCorrect" int,
        "startUnit" int,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_placement_attempts_account" UNIQUE ("accountId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "placement_settings" (
        "id" smallint PRIMARY KEY CHECK ("id" = 1),
        "unit2Threshold" int NOT NULL,
        "unit3Threshold" int NOT NULL,
        "updatedBy" uuid,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "placement_settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "placement_attempts"');
  }
}

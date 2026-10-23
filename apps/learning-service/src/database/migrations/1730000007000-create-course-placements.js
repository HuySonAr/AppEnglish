export class CreateCoursePlacements1730000007000 {
  name = 'CreateCoursePlacements1730000007000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_placements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL UNIQUE,
        "status" varchar(12) NOT NULL CHECK ("status" IN ('COMPLETED', 'SKIPPED')),
        "versionId" uuid,
        "startLevel" varchar(2) NOT NULL CHECK ("startLevel" IN ('A1', 'A2', 'B1', 'B2', 'C1')),
        "levelScores" jsonb NOT NULL DEFAULT '[]',
        "answers" jsonb NOT NULL DEFAULT '{}',
        "completedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "course_placements"');
  }
}

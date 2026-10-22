// The Listening course has no placement and no mistakes notebook (D145), so
// their tables go (D146). Both were empty when dropped; down() recreates them
// as migrations 1730000007000 and 1730000008000 made them.
export class DropCoursePlacementsAndMistakes1730000011000 {
  name = 'DropCoursePlacementsAndMistakes1730000011000';

  async up(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "course_mistakes"');
    await queryRunner.query('DROP TABLE IF EXISTS "course_placements"');
  }

  async down(queryRunner) {
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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_mistakes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "unitId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "segmentId" uuid NOT NULL,
        "level" varchar(2) NOT NULL,
        "unitTitle" varchar(200) NOT NULL,
        "lessonTitle" varchar(200) NOT NULL,
        "text" text NOT NULL,
        "speaker" varchar(100) NOT NULL DEFAULT '',
        "missedWords" jsonb NOT NULL DEFAULT '[]',
        "timesMissed" int NOT NULL DEFAULT 1,
        "lastMissedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_course_mistakes_account_lesson_segment" UNIQUE ("accountId", "lessonId", "segmentId")
      )
    `);
  }
}

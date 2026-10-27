export class DropCourseResults1730000019000 {
  name = 'DropCourseResults1730000019000';

  async up(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "course_test_results"');
    await queryRunner.query('DROP TABLE IF EXISTS "course_lesson_results"');
  }

  async down(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lesson_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "unitId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "bestScore" int NOT NULL CHECK ("bestScore" BETWEEN 0 AND 100),
        "lastScore" int NOT NULL CHECK ("lastScore" BETWEEN 0 AND 100),
        "attemptCount" int NOT NULL DEFAULT 1,
        "passedAt" timestamptz,
        "lastAttemptAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_course_lesson_results_account_lesson" UNIQUE ("accountId", "lessonId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_test_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "kind" varchar(12) NOT NULL CHECK ("kind" IN ('unit_check', 'level_test')),
        "level" varchar(2) NOT NULL,
        "bestScore" int NOT NULL CHECK ("bestScore" BETWEEN 0 AND 100),
        "lastScore" int NOT NULL CHECK ("lastScore" BETWEEN 0 AND 100),
        "attemptCount" int NOT NULL DEFAULT 1,
        "passedAt" timestamptz,
        "lastAttemptAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_course_test_results_account_item" UNIQUE ("accountId", "itemId")
      )
    `);
  }
}

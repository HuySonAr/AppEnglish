export class CreateCourseLessonResults1730000005000 {
  name = 'CreateCourseLessonResults1730000005000';

  async up(queryRunner) {
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
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "course_lesson_results"');
  }
}

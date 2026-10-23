export class CreateLessonFlow1730000001000 {
  name = 'CreateLessonFlow1730000001000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_progress" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "reviewPassedAt" timestamptz,
        "vocabularyStudiedAt" timestamptz,
        "vocabularyQuizPassedAt" timestamptz,
        "fillInPassedAt" timestamptz,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_progress_account_lesson" UNIQUE ("accountId", "lessonId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_test_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "accountEmail" varchar(320) NOT NULL DEFAULT '',
        "lessonId" uuid NOT NULL,
        "lessonVersionId" uuid NOT NULL,
        "attemptNumber" int NOT NULL,
        "status" varchar(16) NOT NULL CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED')),
        "startedAt" timestamptz NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "submittedAt" timestamptz,
        "optionOrder" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "totalCount" int,
        "correctCount" int,
        "listeningCorrect" int,
        "readingCorrect" int,
        "durationSeconds" int,
        "passed" boolean,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_test_attempts_number" UNIQUE ("accountId", "lessonId", "attemptNumber")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lesson_test_attempts_open" ON "lesson_test_attempts" ("accountId", "lessonId") WHERE "status" = 'IN_PROGRESS'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lesson_test_attempts_ranking" ON "lesson_test_attempts" ("lessonId", "attemptNumber", "status")`);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "lesson_test_attempts"');
    await queryRunner.query('DROP TABLE IF EXISTS "lesson_progress"');
  }
}

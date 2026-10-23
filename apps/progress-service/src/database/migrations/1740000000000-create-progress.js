export class CreateProgress1740000000000 {
  name = 'CreateProgress1740000000000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "skill_results" (
        "id" uuid PRIMARY KEY,
        "accountId" uuid NOT NULL,
        "source" varchar(16) NOT NULL CHECK ("source" IN ('LESSON_TEST', 'MOCK_TEST')),
        "sourceId" uuid NOT NULL,
        "attemptNumber" int NOT NULL,
        "correctCount" int NOT NULL,
        "totalCount" int NOT NULL,
        "listeningCorrect" int NOT NULL,
        "listeningTotal" int NOT NULL,
        "readingCorrect" int NOT NULL,
        "readingTotal" int NOT NULL,
        "submittedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_skill_results_account" ON "skill_results" ("accountId")');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_completions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "completedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_completions_account_lesson" UNIQUE ("accountId", "lessonId")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "lesson_completions"');
    await queryRunner.query('DROP TABLE IF EXISTS "skill_results"');
  }
}

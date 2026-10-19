// Listening course (F05C, D102): each learner's best and latest score on each
// unit check (itemId = the unit id) and level test, and when it was first
// passed. Passing a level test moves the learner up. Items live in
// content-service, so itemId is not a foreign key.
export class CreateCourseTestResults1730000006000 {
  name = 'CreateCourseTestResults1730000006000';

  async up(queryRunner) {
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

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "course_test_results"');
  }
}

// Mock-test attempts and the score conversion table (F05A). accountId,
// mockTestId and mockVersionId refer to other services' data: no foreign key.
export class CreateMockAttempts1730000002000 {
  name = 'CreateMockAttempts1730000002000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "mockTestId" uuid NOT NULL,
        "mockVersionId" uuid NOT NULL,
        "kind" varchar(8) NOT NULL CHECK ("kind" IN ('FULL', 'MINI')),
        "partKey" varchar(8) NOT NULL DEFAULT '',
        "attemptNumber" int NOT NULL,
        "status" varchar(16) NOT NULL CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED')),
        "startedAt" timestamptz NOT NULL,
        "expiresAt" timestamptz,
        "submittedAt" timestamptz,
        "optionOrder" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "totalCount" int,
        "correctCount" int,
        "listeningCorrect" int,
        "listeningTotal" int,
        "readingCorrect" int,
        "readingTotal" int,
        "listeningScore" int,
        "readingScore" int,
        "durationSeconds" int,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mock_attempts_number" UNIQUE ("accountId", "mockTestId", "kind", "partKey", "attemptNumber")
      )
    `);
    // At most one attempt in progress per learner for the full test and for
    // each part's mini test.
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mock_attempts_open" ON "mock_attempts" ("accountId", "mockTestId", "kind", "partKey") WHERE "status" = 'IN_PROGRESS'`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "score_conversion" (
        "id" smallint PRIMARY KEY CHECK ("id" = 1),
        "listening" jsonb NOT NULL,
        "reading" jsonb NOT NULL,
        "updatedBy" uuid,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "score_conversion"');
    await queryRunner.query('DROP TABLE IF EXISTS "mock_attempts"');
  }
}

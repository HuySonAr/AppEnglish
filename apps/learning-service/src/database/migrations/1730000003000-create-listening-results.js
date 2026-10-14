// Listening practice (F05B-3, D86): the best and latest accuracy of each
// learner on each dictation exercise. Exercises live in content-service, so
// exerciseId is not a foreign key.
export class CreateListeningResults1730000003000 {
  name = 'CreateListeningResults1730000003000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "exerciseId" uuid NOT NULL,
        "bestAccuracy" int NOT NULL CHECK ("bestAccuracy" BETWEEN 0 AND 100),
        "lastAccuracy" int NOT NULL CHECK ("lastAccuracy" BETWEEN 0 AND 100),
        "checkCount" int NOT NULL DEFAULT 1,
        "lastCheckedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listening_results_account_exercise" UNIQUE ("accountId", "exerciseId")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "listening_results"');
  }
}

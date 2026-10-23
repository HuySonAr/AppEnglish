export class CreateLearnerGoals1730000012000 {
  name = 'CreateLearnerGoals1730000012000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "learner_goals" (
        "accountId" uuid NOT NULL PRIMARY KEY,
        "targetScore" int NOT NULL,
        "examDate" date,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "learner_goals"');
  }
}

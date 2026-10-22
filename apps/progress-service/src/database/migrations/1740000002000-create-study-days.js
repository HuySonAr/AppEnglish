export class CreateStudyDays1740000002000 {
  name = 'CreateStudyDays1740000002000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "study_days" (
        "accountId" uuid NOT NULL,
        "day" date NOT NULL,
        "activities" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "firstAt" timestamptz NOT NULL,
        "lastAt" timestamptz NOT NULL,
        PRIMARY KEY ("accountId", "day")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "study_days"');
  }
}

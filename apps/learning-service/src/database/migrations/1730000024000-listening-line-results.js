export class ListeningLineResults1730000024000 {
  name = 'ListeningLineResults1730000024000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_line_results" (
        "accountId" uuid NOT NULL,
        "exerciseId" uuid NOT NULL,
        "segmentId" uuid NOT NULL,
        "status" varchar(10) NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("accountId", "exerciseId", "segmentId")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "listening_line_results"');
  }
}

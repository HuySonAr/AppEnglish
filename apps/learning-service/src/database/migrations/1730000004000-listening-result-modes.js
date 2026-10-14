// Songs (F05B-4, D88): a learner's best score is kept per mode, writing every
// line ('full') or filling in the blanks ('blanks'). Existing rows are full.
export class ListeningResultModes1730000004000 {
  name = 'ListeningResultModes1730000004000';

  async up(queryRunner) {
    await queryRunner.query(`ALTER TABLE "listening_results" ADD COLUMN IF NOT EXISTS "mode" varchar(10) NOT NULL DEFAULT 'full' CHECK ("mode" IN ('full', 'blanks'))`);
    await queryRunner.query('ALTER TABLE "listening_results" DROP CONSTRAINT IF EXISTS "UQ_listening_results_account_exercise"');
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listening_results" ADD CONSTRAINT "UQ_listening_results_account_exercise_mode" UNIQUE ("accountId", "exerciseId", "mode");
      EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
      END $$
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DELETE FROM "listening_results" WHERE "mode" <> 'full'`);
    await queryRunner.query('ALTER TABLE "listening_results" DROP CONSTRAINT IF EXISTS "UQ_listening_results_account_exercise_mode"');
    await queryRunner.query('ALTER TABLE "listening_results" ADD CONSTRAINT "UQ_listening_results_account_exercise" UNIQUE ("accountId", "exerciseId")');
    await queryRunner.query('ALTER TABLE "listening_results" DROP COLUMN IF EXISTS "mode"');
  }
}

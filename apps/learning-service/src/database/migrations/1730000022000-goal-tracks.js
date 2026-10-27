export class GoalTracks1730000022000 {
  name = 'GoalTracks1730000022000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "learner_goals" ALTER COLUMN "targetScore" DROP NOT NULL');
    await queryRunner.query('ALTER TABLE "learner_goals" ADD COLUMN IF NOT EXISTS "lrEnabled" boolean NOT NULL DEFAULT true');
    await queryRunner.query('ALTER TABLE "learner_goals" ADD COLUMN IF NOT EXISTS "swEnabled" boolean NOT NULL DEFAULT false');
    await queryRunner.query('ALTER TABLE "learner_goals" ADD COLUMN IF NOT EXISTS "speakingTarget" int');
    await queryRunner.query('ALTER TABLE "learner_goals" ADD COLUMN IF NOT EXISTS "writingTarget" int');
    await queryRunner.query('ALTER TABLE "learner_goals" ADD COLUMN IF NOT EXISTS "swExamDate" date');
  }

  async down(queryRunner) {
    await queryRunner.query('DELETE FROM "learner_goals" WHERE "targetScore" IS NULL');
    for (const column of ['swExamDate', 'writingTarget', 'speakingTarget', 'swEnabled', 'lrEnabled'])
      await queryRunner.query(`ALTER TABLE "learner_goals" DROP COLUMN IF EXISTS "${column}"`);
    await queryRunner.query('ALTER TABLE "learner_goals" ALTER COLUMN "targetScore" SET NOT NULL');
  }
}

export class AddAiKeySettings1730000018000 {
  name = 'AddAiKeySettings1730000018000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "ai_keys" ADD COLUMN IF NOT EXISTS "model" varchar(60)');
    await queryRunner.query('ALTER TABLE "ai_keys" ADD COLUMN IF NOT EXISTS "thinkingLevel" varchar(10)');
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "ai_keys" DROP COLUMN IF EXISTS "thinkingLevel"');
    await queryRunner.query('ALTER TABLE "ai_keys" DROP COLUMN IF EXISTS "model"');
  }
}

export class ListeningTopicLevel1720000024000 {
  name = 'ListeningTopicLevel1720000024000';

  async up(queryRunner) {
    await queryRunner.query(`ALTER TABLE "listening_topics" ADD COLUMN IF NOT EXISTS "level" varchar(20)`);
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "listening_topics" DROP COLUMN IF EXISTS "level"`);
  }
}

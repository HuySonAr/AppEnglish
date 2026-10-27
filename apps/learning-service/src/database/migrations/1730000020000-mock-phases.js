export class MockPhases1730000020000 {
  name = 'MockPhases1730000020000';

  async up(queryRunner) {
    await queryRunner.query(`ALTER TABLE "mock_attempts" ADD COLUMN IF NOT EXISTS "format" varchar(16) NOT NULL DEFAULT 'full'`);
    await queryRunner.query(`ALTER TABLE "mock_attempts" ADD COLUMN IF NOT EXISTS "readingStartedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "mock_attempts" ADD COLUMN IF NOT EXISTS "listeningPosition" int NOT NULL DEFAULT 0`);
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "mock_attempts" DROP COLUMN IF EXISTS "listeningPosition"`);
    await queryRunner.query(`ALTER TABLE "mock_attempts" DROP COLUMN IF EXISTS "readingStartedAt"`);
    await queryRunner.query(`ALTER TABLE "mock_attempts" DROP COLUMN IF EXISTS "format"`);
  }
}

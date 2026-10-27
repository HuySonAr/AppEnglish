import { mockContentSchema, mockFullStructureIssues } from '../../content/content.schemas.js';

export class MockFormat1720000021000 {
  name = 'MockFormat1720000021000';

  async up(queryRunner) {
    await queryRunner.query(`ALTER TABLE "mock_tests" ADD COLUMN IF NOT EXISTS "format" varchar(16) NOT NULL DEFAULT 'full'`);
    await queryRunner.query(`ALTER TABLE "mock_tests" DROP CONSTRAINT IF EXISTS "CK_mock_tests_format"`);
    await queryRunner.query(`ALTER TABLE "mock_tests" ADD CONSTRAINT "CK_mock_tests_format" CHECK ("format" IN ('full', 'practice'))`);
    const rows = await queryRunner.query(
      `SELECT m."id", v."content" FROM "mock_tests" m JOIN "mock_test_versions" v ON v."id" = m."publishedVersionId"`,
    );
    for (const row of rows) {
      const parsed = mockContentSchema.safeParse(row.content);
      if (!parsed.success || mockFullStructureIssues(parsed.data.test).length)
        await queryRunner.query(`UPDATE "mock_tests" SET "format" = 'practice' WHERE "id" = $1`, [row.id]);
    }
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "mock_tests" DROP CONSTRAINT IF EXISTS "CK_mock_tests_format"`);
    await queryRunner.query(`ALTER TABLE "mock_tests" DROP COLUMN IF EXISTS "format"`);
  }
}

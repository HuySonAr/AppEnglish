const TABLES = [
  ['lesson_versions', '"lessonId"'],
  ['placement_versions', '(1)'],
  ['mock_test_versions', '"mockTestId"'],
  ['listening_exercise_versions', '"exerciseId"'],
  ['unit_review_versions', '"unitId"'],
];

export class ContentReview1720000020000 {
  name = 'ContentReview1720000020000';

  async up(queryRunner) {
    for (const [table, owner] of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${table}_status_check"`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${table}_status_check" CHECK ("status" IN ('DRAFT', 'PENDING_REVIEW', 'RETURNED', 'PUBLISHED'))`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "editedBy" uuid`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "submittedBy" uuid`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "submittedAt" timestamptz`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "reviewedBy" uuid`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "reviewedAt" timestamptz`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "reviewNote" text`);
      await queryRunner.query(`DROP INDEX IF EXISTS "UQ_${table}_one_draft"`);
      await queryRunner.query(`CREATE UNIQUE INDEX "UQ_${table}_one_draft" ON "${table}" (${owner}) WHERE "status" IN ('DRAFT', 'PENDING_REVIEW', 'RETURNED')`);
    }
  }

  async down(queryRunner) {
    for (const [table, owner] of TABLES) {
      await queryRunner.query(`UPDATE "${table}" SET "status" = 'DRAFT' WHERE "status" IN ('PENDING_REVIEW', 'RETURNED')`);
      await queryRunner.query(`DROP INDEX IF EXISTS "UQ_${table}_one_draft"`);
      const column = owner === '(1)' ? '"status"' : owner;
      await queryRunner.query(`CREATE UNIQUE INDEX "UQ_${table}_one_draft" ON "${table}" (${column}) WHERE "status" = 'DRAFT'`);
      for (const name of ['editedBy', 'submittedBy', 'submittedAt', 'reviewedBy', 'reviewedAt', 'reviewNote'])
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${name}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${table}_status_check"`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${table}_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED'))`);
    }
  }
}

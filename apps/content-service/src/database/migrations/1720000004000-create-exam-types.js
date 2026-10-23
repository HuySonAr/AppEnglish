export class CreateExamTypes1720000004000 {
  name = 'CreateExamTypes1720000004000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exam_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "name" varchar(100) NOT NULL,
        "format" varchar(20),
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_exam_types_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "exam_types" ("code", "name", "format") VALUES ('toeic', 'TOEIC', 'toeic')
      ON CONFLICT ("code") DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE "mock_tests" ADD COLUMN IF NOT EXISTS "examTypeId" uuid REFERENCES "exam_types" ("id")`);
    await queryRunner.query(`
      UPDATE "mock_tests" SET "examTypeId" = (SELECT "id" FROM "exam_types" WHERE "code" = 'toeic')
      WHERE "examTypeId" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "mock_tests" ALTER COLUMN "examTypeId" SET NOT NULL`);
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "mock_tests" DROP COLUMN IF EXISTS "examTypeId"');
    await queryRunner.query('DROP TABLE IF EXISTS "exam_types"');
  }
}

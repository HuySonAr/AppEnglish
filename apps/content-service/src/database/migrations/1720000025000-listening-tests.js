export class ListeningTests1720000025000 {
  name = 'ListeningTests1720000025000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listening_tests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "topicId" uuid NOT NULL REFERENCES "listening_topics" ("id") ON DELETE RESTRICT,
        "name" varchar(100) NOT NULL,
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_listening_tests_topic_name" ON "listening_tests" ("topicId", lower("name"))');
    await queryRunner.query('ALTER TABLE "listening_exercises" ADD COLUMN IF NOT EXISTS "testId" uuid REFERENCES "listening_tests" ("id") ON DELETE RESTRICT');
    await queryRunner.query(`
      INSERT INTO "listening_tests" ("topicId", "name")
      SELECT DISTINCT e."topicId", 'Test 1' FROM "listening_exercises" e JOIN "listening_topics" t ON t."id" = e."topicId"
      WHERE t."format" = 'toeic' AND e."testId" IS NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "listening_exercises" e SET "testId" = s."id" FROM "listening_tests" s, "listening_topics" t
      WHERE t."id" = e."topicId" AND t."format" = 'toeic' AND e."testId" IS NULL AND s."topicId" = e."topicId" AND lower(s."name") = 'test 1'
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_exercises" DROP COLUMN IF EXISTS "testId"');
    await queryRunner.query('DROP TABLE IF EXISTS "listening_tests"');
  }
}

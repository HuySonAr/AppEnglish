export class CreatePracticePrompts1720000018000 {
  name = 'CreatePracticePrompts1720000018000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "practice_prompts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('read_aloud', 'open_speaking', 'writing')),
        "authorId" uuid NOT NULL,
        "publishedVersionId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "practice_prompt_versions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "promptId" uuid NOT NULL REFERENCES "practice_prompts" ("id") ON DELETE CASCADE,
        "versionNumber" int NOT NULL,
        "status" varchar(20) NOT NULL,
        "content" jsonb NOT NULL,
        "reviewNote" text,
        "submittedAt" timestamptz,
        "reviewedBy" uuid,
        "reviewedAt" timestamptz,
        "createdBy" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_practice_prompt_versions_number" UNIQUE ("promptId", "versionNumber")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_practice_prompts_author" ON "practice_prompts" ("authorId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_practice_prompt_versions_status" ON "practice_prompt_versions" ("status")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "practice_prompt_versions"');
    await queryRunner.query('DROP TABLE IF EXISTS "practice_prompts"');
  }
}

export class PracticeEtsTask1720000022000 {
  name = 'PracticeEtsTask1720000022000';

  async up(queryRunner) {
    await queryRunner.query(
      `UPDATE "practice_prompt_versions" v SET "content" = v."content" || '{"etsTask":"read_aloud"}'::jsonb FROM "practice_prompts" p WHERE p."id" = v."promptId" AND p."kind" = 'read_aloud' AND NOT (v."content" ? 'etsTask')`,
    );
    await queryRunner.query(
      `UPDATE "practice_prompt_versions" v SET "content" = v."content" || '{"etsTask":"respond_email"}'::jsonb FROM "practice_prompts" p WHERE p."id" = v."promptId" AND p."kind" = 'writing' AND v."content"->>'taskType' = 'email' AND NOT (v."content" ? 'etsTask')`,
    );
    await queryRunner.query(
      `UPDATE "practice_prompt_versions" v SET "content" = v."content" || '{"etsTask":"opinion_essay"}'::jsonb FROM "practice_prompts" p WHERE p."id" = v."promptId" AND p."kind" = 'writing' AND v."content"->>'taskType' = 'essay' AND NOT (v."content" ? 'etsTask')`,
    );
  }

  async down(queryRunner) {
    await queryRunner.query(`UPDATE "practice_prompt_versions" SET "content" = "content" - 'etsTask'`);
  }
}

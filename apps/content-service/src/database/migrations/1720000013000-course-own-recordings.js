export class CourseOwnRecordings1720000013000 {
  name = 'CourseOwnRecordings1720000013000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ALTER COLUMN "exerciseId" DROP NOT NULL');
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD COLUMN IF NOT EXISTS "courseItemId" uuid REFERENCES "listening_course_items" ("id") ON DELETE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "listening_timing_jobs" ADD CONSTRAINT "CHK_listening_timing_jobs_owner" CHECK (num_nonnulls("exerciseId", "courseItemId") = 1)',
    );
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_listening_timing_jobs_course_item" ON "listening_timing_jobs" ("courseItemId", "createdAt")');
    await queryRunner.query(`
      UPDATE "listening_course_versions" v
      SET "content" = (v."content" - 'exerciseId' - 'sentences') || '{"audioMediaId": null, "segments": []}'::jsonb
      FROM "listening_course_items" i
      WHERE i."id" = v."itemId" AND i."type" = 'topic'
    `);
    await queryRunner.query(`
      UPDATE "listening_course_versions" v
      SET "content" = jsonb_build_object('sections', COALESCE((
        SELECT jsonb_agg((s - 'exerciseId') || '{"audioMediaId": null, "transcript": ""}'::jsonb ORDER BY n)
        FROM jsonb_array_elements(v."content"->'sections') WITH ORDINALITY AS t(s, n)
      ), '[]'::jsonb))
      FROM "listening_course_items" i
      WHERE i."id" = v."itemId" AND i."type" = 'level_test'
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DELETE FROM "listening_timing_jobs" WHERE "courseItemId" IS NOT NULL');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listening_timing_jobs_course_item"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP CONSTRAINT IF EXISTS "CHK_listening_timing_jobs_owner"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" DROP COLUMN IF EXISTS "courseItemId"');
    await queryRunner.query('ALTER TABLE "listening_timing_jobs" ALTER COLUMN "exerciseId" SET NOT NULL');
    await queryRunner.query(`
      UPDATE "listening_course_versions" v
      SET "content" = (v."content" - 'audioMediaId' - 'segments') || '{"exerciseId": null, "sentences": []}'::jsonb
      FROM "listening_course_items" i
      WHERE i."id" = v."itemId" AND i."type" = 'topic'
    `);
    await queryRunner.query(`
      UPDATE "listening_course_versions" v
      SET "content" = jsonb_build_object('sections', COALESCE((
        SELECT jsonb_agg((s - 'audioMediaId' - 'transcript') || '{"exerciseId": null}'::jsonb ORDER BY n)
        FROM jsonb_array_elements(v."content"->'sections') WITH ORDINALITY AS t(s, n)
      ), '[]'::jsonb))
      FROM "listening_course_items" i
      WHERE i."id" = v."itemId" AND i."type" = 'level_test'
    `);
  }
}

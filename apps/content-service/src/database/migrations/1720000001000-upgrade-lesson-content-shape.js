export class UpgradeLessonContentShape1720000001000 {
  name = 'UpgradeLessonContentShape1720000001000';

  async up(queryRunner) {
    await queryRunner.query(`
      UPDATE "lesson_versions"
      SET "content" = jsonb_build_object(
        'vocabulary', coalesce("content"->'vocabulary', '[]'::jsonb),
        'fillIn', jsonb_build_object(
          'passage', coalesce((SELECT string_agg(item->>'sentence', E'\\n') FROM jsonb_array_elements("content"->'fillIn') item), ''),
          'answers', coalesce((SELECT jsonb_agg(item->>'answer') FROM jsonb_array_elements("content"->'fillIn') item), '[]'::jsonb)
        ),
        'test', '{}'::jsonb
      )
      WHERE jsonb_typeof("content"->'fillIn') = 'array'
    `);
  }

  async down() {}
}

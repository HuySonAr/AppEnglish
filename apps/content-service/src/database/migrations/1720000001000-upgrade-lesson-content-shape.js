// Converts lesson versions written before D43–D45 (fill-in as a list of
// sentences, test as a flat question list) to the current shape: fill-in as one
// passage with answers and a seven-part test. Vocabulary is kept. Old flat test
// questions have no part and cannot be mapped, so the test starts empty.
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

  // The old shape cannot be rebuilt from the new one.
  async down() {}
}

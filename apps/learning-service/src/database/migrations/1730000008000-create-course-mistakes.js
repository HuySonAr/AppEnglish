// Listening course mistakes (F05C, D104): each sentence a learner wrote down
// wrong when finishing a lesson, with the words missed, until it is written
// right. The sentence, lesson and unit titles are kept as they were, so the
// notebook still reads when the content changes; the ids are content-service
// ids without a foreign key.
export class CreateCourseMistakes1730000008000 {
  name = 'CreateCourseMistakes1730000008000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_mistakes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" uuid NOT NULL,
        "unitId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "segmentId" uuid NOT NULL,
        "level" varchar(2) NOT NULL,
        "unitTitle" varchar(200) NOT NULL,
        "lessonTitle" varchar(200) NOT NULL,
        "text" text NOT NULL,
        "speaker" varchar(100) NOT NULL DEFAULT '',
        "missedWords" jsonb NOT NULL DEFAULT '[]',
        "timesMissed" int NOT NULL DEFAULT 1,
        "lastMissedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_course_mistakes_account_lesson_segment" UNIQUE ("accountId", "lessonId", "segmentId")
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "course_mistakes"');
  }
}

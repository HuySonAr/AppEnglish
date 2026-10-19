import { CourseLessonResultEntity, CourseMistakeEntity, CoursePlacementEntity, CourseTestResultEntity } from '../database/learning.entities.js';

export class CourseRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity = CourseLessonResultEntity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async listResults(accountId) {
    return (await this.repo()).find({ where: { accountId } });
  }

  async findResult(accountId, lessonId) {
    return (await this.repo()).findOne({ where: { accountId, lessonId } });
  }

  // Records one finished lesson in a single statement: the best score is
  // never lowered and the first pass is kept.
  async recordAttempt(accountId, unitId, lessonId, score, passed, at) {
    const repository = await this.repo();
    await repository.query(
      `INSERT INTO "course_lesson_results" ("accountId", "unitId", "lessonId", "bestScore", "lastScore", "attemptCount", "passedAt", "lastAttemptAt")
       VALUES ($1, $2, $3, $4, $4, 1, CASE WHEN $5::boolean THEN $6::timestamptz END, $6)
       ON CONFLICT ("accountId", "lessonId") DO UPDATE SET
         "unitId" = EXCLUDED."unitId",
         "bestScore" = GREATEST("course_lesson_results"."bestScore", EXCLUDED."bestScore"),
         "lastScore" = EXCLUDED."lastScore",
         "attemptCount" = "course_lesson_results"."attemptCount" + 1,
         "passedAt" = COALESCE("course_lesson_results"."passedAt", EXCLUDED."passedAt"),
         "lastAttemptAt" = EXCLUDED."lastAttemptAt",
         "updatedAt" = now()`,
      [accountId, unitId, lessonId, score, passed, at],
    );
    return this.findResult(accountId, lessonId);
  }

  // Unit checks and level tests (D102), by item id.
  async listTestResults(accountId) {
    return (await this.repo(CourseTestResultEntity)).find({ where: { accountId } });
  }

  async findTestResult(accountId, itemId) {
    return (await this.repo(CourseTestResultEntity)).findOne({ where: { accountId, itemId } });
  }

  async recordTestAttempt(accountId, itemId, kind, level, score, passed, at) {
    const repository = await this.repo(CourseTestResultEntity);
    await repository.query(
      `INSERT INTO "course_test_results" ("accountId", "itemId", "kind", "level", "bestScore", "lastScore", "attemptCount", "passedAt", "lastAttemptAt")
       VALUES ($1, $2, $3, $4, $5, $5, 1, CASE WHEN $6::boolean THEN $7::timestamptz END, $7)
       ON CONFLICT ("accountId", "itemId") DO UPDATE SET
         "bestScore" = GREATEST("course_test_results"."bestScore", EXCLUDED."bestScore"),
         "lastScore" = EXCLUDED."lastScore",
         "attemptCount" = "course_test_results"."attemptCount" + 1,
         "passedAt" = COALESCE("course_test_results"."passedAt", EXCLUDED."passedAt"),
         "lastAttemptAt" = EXCLUDED."lastAttemptAt",
         "updatedAt" = now()`,
      [accountId, itemId, kind, level, score, passed, at],
    );
    return this.findTestResult(accountId, itemId);
  }

  // The listening placement (D103): one row per learner once taken or skipped.
  async findPlacement(accountId) {
    return (await this.repo(CoursePlacementEntity)).findOne({ where: { accountId } });
  }

  // Returns null when the learner already has one (taken or skipped).
  async createPlacement(placement) {
    const repository = await this.repo(CoursePlacementEntity);
    const inserted = await repository
      .createQueryBuilder()
      .insert()
      .values(placement)
      .orIgnore()
      .returning('*')
      .execute();
    return inserted.raw.length ? this.findPlacement(placement.accountId) : null;
  }

  // The sentences written down wrong (D104), the latest first.
  async listMistakes(accountId) {
    return (await this.repo(CourseMistakeEntity)).find({ where: { accountId }, order: { lastMissedAt: 'DESC' } });
  }

  async findMistake(accountId, id) {
    return (await this.repo(CourseMistakeEntity)).findOne({ where: { accountId, id } });
  }

  // A sentence written wrong again counts once more, with the words missed
  // this time.
  async recordMistake(mistake) {
    const repository = await this.repo(CourseMistakeEntity);
    await repository.query(
      `INSERT INTO "course_mistakes" ("accountId", "unitId", "lessonId", "segmentId", "level", "unitTitle", "lessonTitle", "text", "speaker", "missedWords", "timesMissed", "lastMissedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)
       ON CONFLICT ("accountId", "lessonId", "segmentId") DO UPDATE SET
         "unitTitle" = EXCLUDED."unitTitle",
         "lessonTitle" = EXCLUDED."lessonTitle",
         "text" = EXCLUDED."text",
         "speaker" = EXCLUDED."speaker",
         "missedWords" = EXCLUDED."missedWords",
         "timesMissed" = "course_mistakes"."timesMissed" + 1,
         "lastMissedAt" = EXCLUDED."lastMissedAt",
         "updatedAt" = now()`,
      [
        mistake.accountId,
        mistake.unitId,
        mistake.lessonId,
        mistake.segmentId,
        mistake.level,
        mistake.unitTitle,
        mistake.lessonTitle,
        mistake.text,
        mistake.speaker,
        JSON.stringify(mistake.missedWords),
        mistake.lastMissedAt,
      ],
    );
  }

  // A sentence written right leaves the notebook.
  async deleteMistake(accountId, lessonId, segmentId) {
    await (await this.repo(CourseMistakeEntity)).delete({ accountId, lessonId, segmentId });
  }
}

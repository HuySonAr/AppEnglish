import { CourseLessonResultEntity, CourseTestResultEntity } from '../database/learning.entities.js';

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

}

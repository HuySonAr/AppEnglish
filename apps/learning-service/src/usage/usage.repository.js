import { In } from 'typeorm';
import { ContentUsageKind } from '@appenglish/content-contracts';
import {
  CourseLessonResultEntity,
  CourseTestResultEntity,
  LessonProgressEntity,
  LessonTestAttemptEntity,
  ListeningResultEntity,
  MockAttemptEntity,
  UnitReviewAttemptEntity,
} from '../database/learning.entities.js';

const sources = Object.freeze({
  [ContentUsageKind.UNIT]: [{ entity: UnitReviewAttemptEntity, column: 'unitId' }],
  [ContentUsageKind.LESSON_VERSION]: [{ entity: LessonTestAttemptEntity, column: 'lessonVersionId' }],
  [ContentUsageKind.MOCK_VERSION]: [{ entity: MockAttemptEntity, column: 'mockVersionId' }],
  [ContentUsageKind.UNIT_REVIEW_VERSION]: [{ entity: UnitReviewAttemptEntity, column: 'reviewVersionId' }],
  [ContentUsageKind.COURSE_VERSION]: [],
  [ContentUsageKind.LISTENING_VERSION]: [],
  [ContentUsageKind.LESSON]: [
    { entity: LessonTestAttemptEntity, column: 'lessonId' },
    { entity: LessonProgressEntity, column: 'lessonId' },
  ],
  [ContentUsageKind.MOCK_TEST]: [{ entity: MockAttemptEntity, column: 'mockTestId' }],
  [ContentUsageKind.LISTENING_EXERCISE]: [{ entity: ListeningResultEntity, column: 'exerciseId' }],
  [ContentUsageKind.COURSE_TOPIC]: [{ entity: CourseLessonResultEntity, column: 'unitId' }],
  [ContentUsageKind.COURSE_TEST]: [{ entity: CourseTestResultEntity, column: 'itemId' }],
});

export class UsageRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async countUsage(kind, ids) {
    const counts = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const source of sources[kind] || []) {
      const repository = await this.repo(source.entity);
      if (!source.column) {
        const total = await repository.count();
        for (const id of ids) counts[id] += total;
        continue;
      }
      const rows = await repository
        .createQueryBuilder('row')
        .select(`row."${source.column}"`, 'id')
        .addSelect('COUNT(*)', 'count')
        .where(`row."${source.column}" IN (:...ids)`, { ids })
        .groupBy(`row."${source.column}"`)
        .getRawMany();
      for (const row of rows) counts[row.id] = (counts[row.id] || 0) + Number(row.count);
    }
    return counts;
  }
}

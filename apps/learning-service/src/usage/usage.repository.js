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

// Where each kind of content leaves learner results (D118): the tables and
// the column that names the content.
const sources = Object.freeze({
  // A unit's own results are the attempts at its review (D121).
  [ContentUsageKind.UNIT]: [{ entity: UnitReviewAttemptEntity, column: 'unitId' }],
  // One stored version (D128): the attempts reviewed against it.
  [ContentUsageKind.LESSON_VERSION]: [{ entity: LessonTestAttemptEntity, column: 'lessonVersionId' }],
  [ContentUsageKind.MOCK_VERSION]: [{ entity: MockAttemptEntity, column: 'mockVersionId' }],
  [ContentUsageKind.UNIT_REVIEW_VERSION]: [{ entity: UnitReviewAttemptEntity, column: 'reviewVersionId' }],
  // Course results are not tied to a version (D145).
  [ContentUsageKind.COURSE_VERSION]: [],
  [ContentUsageKind.LISTENING_VERSION]: [],
  [ContentUsageKind.LESSON]: [
    { entity: LessonTestAttemptEntity, column: 'lessonId' },
    { entity: LessonProgressEntity, column: 'lessonId' },
  ],
  [ContentUsageKind.MOCK_TEST]: [{ entity: MockAttemptEntity, column: 'mockTestId' }],
  [ContentUsageKind.LISTENING_EXERCISE]: [{ entity: ListeningResultEntity, column: 'exerciseId' }],
  // A topic completed is kept with the topic id as unitId and lessonId (D145).
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

  // How many learner rows name each id: { [id]: count }. Ids without rows are 0.
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

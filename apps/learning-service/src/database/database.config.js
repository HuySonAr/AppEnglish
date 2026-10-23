import { DataSource } from 'typeorm';
import {
  AiKeyEntity,
  CourseLessonResultEntity,
  CourseTestResultEntity,
  LearningEventEntity,
  LessonProgressEntity,
  LessonTestAttemptEntity,
  ListeningResultEntity,
  MockAttemptEntity,
  LearnerGoalEntity,
  MockReviewAnswerEntity,
  PlacementAttemptEntity,
  PlacementSettingsEntity,
  PracticeSubmissionEntity,
  ReviewRequestEntity,
  ScoreConversionEntity,
  UnitReviewAttemptEntity,
} from './learning.entities.js';

export function createLearningDataSource() {
  return new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.LEARNING_DATABASE_NAME || 'app_learning',
    entities: [
      PlacementAttemptEntity,
      PlacementSettingsEntity,
      LessonProgressEntity,
      LessonTestAttemptEntity,
      UnitReviewAttemptEntity,
      MockAttemptEntity,
      LearnerGoalEntity,
      MockReviewAnswerEntity,
      ScoreConversionEntity,
      ListeningResultEntity,
      CourseLessonResultEntity,
      CourseTestResultEntity,
      LearningEventEntity,
      PracticeSubmissionEntity,
      AiKeyEntity,
      ReviewRequestEntity,
    ],
    migrations: ['src/database/migrations/*.js'],
  });
}

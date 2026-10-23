import { DataSource } from 'typeorm';
import { LessonCompletionEntity, NotificationEntity, SkillResultEntity, StudyDayEntity, XpLedgerEntity } from './progress.entities.js';

export function createProgressDataSource() {
  return new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.PROGRESS_DATABASE_NAME || 'app_progress',
    entities: [SkillResultEntity, LessonCompletionEntity, XpLedgerEntity, StudyDayEntity, NotificationEntity],
    migrations: ['src/database/migrations/*.js'],
  });
}

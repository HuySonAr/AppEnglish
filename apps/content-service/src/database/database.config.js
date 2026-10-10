import { DataSource } from 'typeorm';
import {
  LessonEntity,
  LessonVersionEntity,
  MediaAssetEntity,
  PlacementVersionEntity,
  UnitEntity,
} from './content.entities.js';

export function createContentDataSource() {
  return new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.CONTENT_DATABASE_NAME || 'app_content',
    entities: [UnitEntity, LessonEntity, LessonVersionEntity, MediaAssetEntity, PlacementVersionEntity],
    migrations: ['src/database/migrations/*.js'],
  });
}

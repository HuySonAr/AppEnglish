import { DataSource } from 'typeorm';
export function createLearningDataSource() {
  return new DataSource({ type: 'postgres', host: process.env.POSTGRES_HOST || 'localhost', port: Number(process.env.POSTGRES_PORT || 5432), username: process.env.POSTGRES_USER || 'postgres', password: process.env.POSTGRES_PASSWORD, database: process.env.LEARNING_DATABASE_NAME || 'app_learning', entities: [] });
}

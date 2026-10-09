import { DataSource } from 'typeorm';
import { AccountEntity } from './account.entity.js';
import { RefreshTokenEntity } from './refresh-token.entity.js';

export function createAuthDataSource() {
  return new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.AUTH_DATABASE_NAME || 'app_identity',
    entities: [AccountEntity, RefreshTokenEntity],
    migrations: ['src/database/migrations/*.js']
  });
}

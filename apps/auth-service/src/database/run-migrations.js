import dataSource from './data-source.js';

try {
  await dataSource.initialize();
  await dataSource.runMigrations();
  console.log('Auth migrations completed.');
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}

import { HealthResponseDto } from './health.dto.js';
export class HealthService {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  check() { return new HealthResponseDto({ service: 'auth-service', status: 'ok', timestamp: new Date().toISOString() }); }
  async ready() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    await this.dataSource.query('SELECT 1');
    return { service: 'auth-service', status: 'ok', timestamp: new Date().toISOString(), database: 'ok' };
  }
}

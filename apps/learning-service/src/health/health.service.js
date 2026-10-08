import { HealthResponseDto } from './health.dto.js';
export class HealthService {
  check() { return new HealthResponseDto({ service: 'learning-service', status: 'ok', timestamp: new Date().toISOString() }); }
}

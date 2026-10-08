import { HealthResponseDto } from './health.dto.js';
export class HealthService {
  check() { return new HealthResponseDto({ service: 'auth-service', status: 'ok', timestamp: new Date().toISOString() }); }
}

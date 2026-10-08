import { HealthResponseDto } from './health.dto.js';

export class HealthService {
  check() {
    return new HealthResponseDto({
      service: 'api-gateway',
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
}

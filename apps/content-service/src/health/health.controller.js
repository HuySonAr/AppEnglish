import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { healthResponseSchema } from './health.schema.js';
export class HealthController {
  constructor() { this.healthService = new HealthService(); }
  check() { return healthResponseSchema.parse(this.healthService.check()); }
}
Controller('health')(HealthController);
Get()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check'));

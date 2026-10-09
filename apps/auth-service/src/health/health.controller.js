import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { healthResponseSchema } from './health.schema.js';
import { AUTH_DATA_SOURCE } from '../database/database.tokens.js';
export class HealthController {
  constructor(dataSource) { this.healthService = new HealthService(dataSource); }
  check() { return healthResponseSchema.parse(this.healthService.check()); }
  async ready() {
    try {
      return await this.healthService.ready();
    } catch {
      throw new HttpException({ code: 'AUTH_DATABASE_UNAVAILABLE', message: 'Authentication database is unavailable' }, 503);
    }
  }
}
Controller('health')(HealthController);
Inject(AUTH_DATA_SOURCE)(HealthController, undefined, 0);
Get()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check'));
Get('ready')(HealthController.prototype, 'ready', Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready'));

import { Controller, Get, HttpException } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { healthResponseSchema } from './health.schema.js';

export class HealthController {
  constructor() {
    this.healthService = new HealthService();
  }

  check() {
    return healthResponseSchema.parse(this.healthService.check());
  }

  async ready() {
    try {
      const response = await fetch(`http://localhost:${process.env.AUTH_SERVICE_PORT || 3001}/health/ready`);
      const payload = await response.json();
      if (!response.ok) throw new HttpException(payload, response.status);
      return payload;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException({ code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Authentication service is unavailable' }, 503);
    }
  }
}

Controller('health')(HealthController);
Get()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check'));
Get('ready')(HealthController.prototype, 'ready', Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready'));

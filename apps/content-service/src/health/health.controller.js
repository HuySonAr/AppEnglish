import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { SpeechBroker } from '../speech/speech.broker.js';
import { HealthService } from './health.service.js';
import { healthResponseSchema } from './health.schema.js';

export class HealthController {
  constructor(broker) {
    this.healthService = new HealthService();
    this.broker = broker;
  }
  check() { return healthResponseSchema.parse(this.healthService.check()); }
  async speech() {
    if (!this.broker) return { status: 'down', detail: 'not configured' };
    try {
      return await this.broker.workerStatus();
    } catch (error) {
      return { status: 'down', detail: error?.message || 'unknown' };
    }
  }
}
Controller('health')(HealthController);
Optional()(HealthController, undefined, 0);
Inject(SpeechBroker)(HealthController, undefined, 0);
Get()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check'));
Get('speech')(HealthController.prototype, 'speech', Object.getOwnPropertyDescriptor(HealthController.prototype, 'speech'));

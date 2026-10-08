import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
export class AppModule {}
Module({ controllers: [HealthController] })(AppModule);

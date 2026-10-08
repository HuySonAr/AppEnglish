import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AuthGatewayController } from './auth/auth-gateway.controller.js';

export class AppModule {}
Module({ controllers: [HealthController, AuthGatewayController] })(AppModule);

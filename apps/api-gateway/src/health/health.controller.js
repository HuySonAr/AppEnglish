import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { HealthService } from './health.service.js';
import { healthResponseSchema } from './health.schema.js';
import { AUTH_GRPC_CLIENT, callAuth } from '../auth/auth-gateway.controller.js';

export class HealthController {
  constructor(client) {
    this.healthService = new HealthService();
    this.client = client;
  }

  onModuleInit() {
    this.auth = this.client.getService(AUTH_GRPC_SERVICE);
  }

  check() {
    return healthResponseSchema.parse(this.healthService.check());
  }

  async ready() {
    const { status, payload } = await callAuth(this.auth, 'Ready');
    if (status >= 400) throw new HttpException(payload, status);
    return payload.data;
  }
}

Controller('health')(HealthController);
Inject(AUTH_GRPC_CLIENT)(HealthController, undefined, 0);
Get()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check'));
Get('ready')(HealthController.prototype, 'ready', Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready'));

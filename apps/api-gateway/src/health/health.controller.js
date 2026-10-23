import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { HealthService } from './health.service.js';
import { healthResponseSchema } from './health.schema.js';
import { AUTH_GRPC_CLIENT, callAuth } from '../auth/auth-gateway.controller.js';
import { resolveSession } from '../auth/session-cache.js';
import { systemOverview } from './system.service.js';
import { Req } from '@nestjs/common';

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

  services() {
    return this.healthService.probeServices({ authReady: () => callAuth(this.auth, 'Ready') });
  }

  async system(request) {
    const account = await resolveSession(this.auth, request);
    if (account.role !== 'ADMIN') throw new HttpException({ code: 26, msg: 'fail', data: {} }, 403);
    return { code: 0, msg: 'success', data: await systemOverview() };
  }
}

Controller('health')(HealthController);
Inject(AUTH_GRPC_CLIENT)(HealthController, undefined, 0);
Get()(HealthController.prototype, 'check', Object.getOwnPropertyDescriptor(HealthController.prototype, 'check'));
Get('ready')(HealthController.prototype, 'ready', Object.getOwnPropertyDescriptor(HealthController.prototype, 'ready'));
Get('services')(HealthController.prototype, 'services', Object.getOwnPropertyDescriptor(HealthController.prototype, 'services'));
Get('system')(HealthController.prototype, 'system', Object.getOwnPropertyDescriptor(HealthController.prototype, 'system'));
Req()(HealthController.prototype, 'system', 0);

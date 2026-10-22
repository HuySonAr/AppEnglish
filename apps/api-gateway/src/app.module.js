import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { authGrpcOptions } from '@appenglish/auth-contracts/grpc';
import { contentGrpcOptions } from '@appenglish/content-contracts/grpc';
import { learningGrpcOptions } from '@appenglish/learning-contracts/grpc';
import { progressGrpcOptions } from '@appenglish/progress-contracts/grpc';
import { HealthController } from './health/health.controller.js';
import { AUTH_GRPC_CLIENT, AuthGatewayController } from './auth/auth-gateway.controller.js';
import { CONTENT_GRPC_CLIENT, ContentGatewayController } from './content/content-gateway.controller.js';
import {
  LEARNING_GRPC_CLIENT,
  LearningGatewayController,
  LessonGatewayController,
  MockGatewayController,
} from './learning/learning-gateway.controller.js';
import { PROGRESS_GRPC_CLIENT, ProgressGatewayController } from './progress/progress-gateway.controller.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';
import { RATE_LIMIT_STORE, createRateLimitStore } from './rate-limit/rate-limit.store.js';

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions() },
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions() },
      { name: LEARNING_GRPC_CLIENT, transport: Transport.GRPC, options: learningGrpcOptions() },
      { name: PROGRESS_GRPC_CLIENT, transport: Transport.GRPC, options: progressGrpcOptions() },
    ]),
  ],
  controllers: [
    HealthController,
    AuthGatewayController,
    ContentGatewayController,
    LearningGatewayController,
    LessonGatewayController,
    MockGatewayController,
    ProgressGatewayController,
  ],
  // Every public route is rate limited (D117); counters live in Redis when
  // REDIS_URL is set, else in memory.
  providers: [
    { provide: RATE_LIMIT_STORE, useFactory: () => createRateLimitStore() },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})(AppModule);

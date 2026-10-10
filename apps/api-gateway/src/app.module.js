import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { authGrpcOptions } from '@appenglish/auth-contracts/grpc';
import { contentGrpcOptions } from '@appenglish/content-contracts/grpc';
import { learningGrpcOptions } from '@appenglish/learning-contracts/grpc';
import { HealthController } from './health/health.controller.js';
import { AUTH_GRPC_CLIENT, AuthGatewayController } from './auth/auth-gateway.controller.js';
import { CONTENT_GRPC_CLIENT, ContentGatewayController } from './content/content-gateway.controller.js';
import { LEARNING_GRPC_CLIENT, LearningGatewayController } from './learning/learning-gateway.controller.js';

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions() },
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions() },
      { name: LEARNING_GRPC_CLIENT, transport: Transport.GRPC, options: learningGrpcOptions() },
    ]),
  ],
  controllers: [HealthController, AuthGatewayController, ContentGatewayController, LearningGatewayController],
})(AppModule);

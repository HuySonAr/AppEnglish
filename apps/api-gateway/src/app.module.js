import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { authGrpcOptions } from '@appenglish/auth-contracts/grpc';
import { HealthController } from './health/health.controller.js';
import { AUTH_GRPC_CLIENT, AuthGatewayController } from './auth/auth-gateway.controller.js';

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: AUTH_GRPC_CLIENT, transport: Transport.GRPC, options: authGrpcOptions() },
    ]),
  ],
  controllers: [HealthController, AuthGatewayController],
})(AppModule);
